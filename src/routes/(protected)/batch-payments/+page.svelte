<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { page } from '$app/stores';
  import { currentUser } from '$lib/firebase';
  import { userProfile, type UserProfile } from '$lib/userProfile';
  import { db } from '$lib/firebase';
  import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

  const ORDER_API_ENDPOINT = 'https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs';

  interface BatchPayment {
    reference: string;
    amount: number;
    paymentMode: 'Direct Deposit' | 'Credit Payment';
    isOverCredit?: boolean;
    creditError?: string;
  }

  let user: any = null;
  let profile: UserProfile | null = null;
  let payments: BatchPayment[] = [createEmptyPayment()];
  let isLoading = false;
  let notification = { show: false, message: '', type: 'info' };

  // Subscribe to user and profile changes
  const unsubUser = currentUser.subscribe(value => {
    user = value;
  });

  const unsubProfile = userProfile.subscribe(value => {
    profile = value;
  });

  onMount(() => {
    return () => {
      unsubUser();
      unsubProfile();
    };
  });

  function createEmptyPayment(): BatchPayment {
    return {
      reference: '',
      amount: 0,
      paymentMode: 'Direct Deposit',
      isOverCredit: false,
      creditError: ''
    };
  }

  function addPayment() {
    payments = [...payments, createEmptyPayment()];
  }

  function removePayment(index: number) {
    payments = payments.filter((_, i) => i !== index);
  }

  async function fetchOrderDetails(invoiceIds: string[]) {
    try {
      const payload = {
        "Filter": {
          "OrderID": invoiceIds,
          "OutputSelector": [
            "Username",
            "ID"
          ]
        },
        "action": "GetOrder"
      };

      console.log('Order API Payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(ORDER_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to fetch order details');
      }

      const data = await response.json();
      console.log('Order API Response:', JSON.stringify(data, null, 2));

      // Extract unique usernames
      const uniqueUsernames = [...new Set(data.Order.map(order => order.Username))];
      console.log('Unique Usernames:', uniqueUsernames);

      return {
        uniqueUsernames,
        rawResponse: data
      };
    } catch (error) {
      console.error('Error fetching order details:', error);
      throw error;
    }
  }

  async function fetchCustomerDetails(usernames: string[]) {
    try {
      const payload = {
        "Filter": {
          "Username": usernames,
          "OutputSelector": [
            "ID",
            "Username",
            "CreditLimit",
            "AvailableCredit",
            "OnCreditHold"
          ]
        },
        "action": "GetCustomer"
      };

      console.log('Customer API Payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(ORDER_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to fetch customer details');
      }

      const data = await response.json();
      console.log('Customer API Response:', JSON.stringify(data, null, 2));
      return data;
    } catch (error) {
      console.error('Error fetching customer details:', error);
      throw error;
    }
  }

  async function validateCreditPayments(payments: BatchPayment[], orderResponse: any, customerResponse: any) {
    // Reset all credit validations first
    payments = payments.map(payment => ({
      ...payment,
      isOverCredit: false,
      creditError: ''
    }));

    if (!customerResponse?.Customer || !Array.isArray(customerResponse.Customer)) {
      console.error('Invalid customer response format');
      return payments;
    }

    if (!orderResponse?.Order || !Array.isArray(orderResponse.Order)) {
      console.error('Invalid order response format');
      return payments;
    }

    // Create a map of invoice ID to username
    const invoiceToUsername = new Map(
      orderResponse.Order.map((order: any) => [order.ID, order.Username])
    );

    // Create a map of username to their total payment amount
    const usernameTotalPayments = new Map<string, number>();

    // Calculate total payments per username
    payments.forEach(payment => {
      if (payment.paymentMode === 'Credit Payment') {
        const username = invoiceToUsername.get(payment.reference);
        if (username) {
          const currentTotal = usernameTotalPayments.get(username) || 0;
          usernameTotalPayments.set(username, currentTotal + payment.amount);
        }
      }
    });

    console.log('Total payments per customer:', Object.fromEntries(usernameTotalPayments));

    // Get customer credit details
    const customerCreditDetails = new Map(
      customerResponse.Customer.map((customer: any) => [
        customer.Username,
        {
          availableCredit: parseFloat(customer.AvailableCredit) || 0,
          creditLimit: parseFloat(customer.CreditLimit) || 0,
          onCreditHold: customer.OnCreditHold === true
        }
      ])
    );

    // Validate each payment considering the total amount per customer
    return payments.map(payment => {
      if (payment.paymentMode === 'Credit Payment') {
        const username = invoiceToUsername.get(payment.reference);
        if (!username) {
          return {
            ...payment,
            isOverCredit: true,
            creditError: 'Invalid invoice ID'
          };
        }

        const creditDetails = customerCreditDetails.get(username);
        if (!creditDetails) {
          return {
            ...payment,
            isOverCredit: true,
            creditError: 'Customer credit details not found'
          };
        }

        const { availableCredit, creditLimit, onCreditHold } = creditDetails;
        const totalCredit = availableCredit + creditLimit;
        const totalCustomerPayments = usernameTotalPayments.get(username) || 0;

        console.log(`
          Customer: ${username}
          Payment amount: ${payment.amount}
          Total customer payments: ${totalCustomerPayments}
          Available credit: ${availableCredit}
          Credit limit: ${creditLimit}
          Total credit: ${totalCredit}
          On hold: ${onCreditHold}
        `);

        if (onCreditHold || totalCustomerPayments > totalCredit) {
          return {
            ...payment,
            isOverCredit: true,
            creditError: onCreditHold 
              ? 'Account is on credit hold'
              : `Combined payments (${totalCustomerPayments.toFixed(2)}) exceed available credit (${totalCredit.toFixed(2)})`
          };
        }
      }
      return payment;
    });
  }

  async function savePaymentSession(creditResult: any, directDepositResult: any, creditPayments: any[], directDepositPayments: any[]) {
    try {
      // Validate user information
      if (!user || !profile) {
        throw new Error('User information not available');
      }

      // Create payment records from results
      const paymentRecords = [];

      // Add credit payments if any
      if (creditResult?.Payment && creditPayments.length > 0) {
        // Handle single credit payment
        if (creditResult.Payment.OrderID && creditResult.Payment.PaymentID) {
          paymentRecords.push({
            orderId: creditResult.Payment.OrderID,
            paymentId: creditResult.Payment.PaymentID,
            paymentMode: 'Credit Payment',
            amount: Number(creditPayments[0].amount) || 0,
            dateProcessed: creditResult.CurrentTime || new Date().toISOString()
          });
        }
      }

      // Add direct deposit payments if any
      if (directDepositResult?.Payment && Array.isArray(directDepositResult.Payment)) {
        directDepositResult.Payment.forEach((payment: any, index: number) => {
          if (payment.OrderID && payment.PaymentID && directDepositPayments[index]) {
            paymentRecords.push({
              orderId: payment.OrderID,
              paymentId: payment.PaymentID,
              paymentMode: 'Direct Deposit',
              amount: Number(directDepositPayments[index].amount) || 0,
              dateProcessed: directDepositResult.CurrentTime || new Date().toISOString()
            });
          }
        });
      }

      // Validate that we have payment records
      if (paymentRecords.length === 0) {
        throw new Error('No valid payment records to save');
      }

      // Create session document with validated data
      const sessionData = {
        sessionId: "PS_" + Date.now().toString(),
        dateCreated: serverTimestamp(),
        userId: user.uid || '',
        userEmail: user.email || '',
        performedBy: {
          firstName: profile.firstName || '',
          lastName: profile.lastName || ''
        },
        payments: paymentRecords.map(record => ({
          orderId: record.orderId || '',
          paymentId: record.paymentId || '',
          paymentMode: record.paymentMode || '',
          amount: record.amount || 0,
          dateProcessed: record.dateProcessed || new Date().toISOString()
        }))
      };

      console.log('=== Saving Payment Session to Firebase ===');
      console.log('Session Data:', JSON.stringify(sessionData, null, 2));

      // Save to Firebase
      const docRef = await addDoc(collection(db, 'payment_sessions'), sessionData);
      console.log('Payment session saved with ID:', docRef.id);

      return docRef.id;
    } catch (error) {
      console.error('Error saving payment session:', error);
      throw error;
    }
  }

  async function handleSubmit() {
    console.log('=== Submit All Payments button clicked ===');
    
    isLoading = true;
    let creditResult = null;
    let directDepositResult = null;

    try {
      // Validate user information
      if (!profile?.firstName || !profile?.lastName) {
        throw new Error('User profile information not found. Please complete your profile first.');
      }

      const processedBy = `${profile.firstName} ${profile.lastName}`;
      
      // Format current time in Australian timezone
      const currentTime = new Date().toLocaleString('en-AU', {
        timeZone: 'Australia/Sydney',
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

      // Separate payments by payment mode
      const creditPayments = payments.filter(p => p.paymentMode === 'Credit Payment');
      const directDepositPayments = payments.filter(p => p.paymentMode === 'Direct Deposit');

      console.log('=== Payment Segregation ===');
      console.log('Credit Payments:', creditPayments);
      console.log('Direct Deposit Payments:', directDepositPayments);

      // Process credit payments
      if (creditPayments.length > 0) {
        const creditPaymentPayload = {
          "Payment": creditPayments.map(payment => ({
            "OrderID": payment.reference,
            "AmountPaid": parseFloat(payment.amount.toString()),
            "DatePaid": new Date().toISOString().split('T')[0],
            "IsCreditPayment": true,
            "TransactionNotes": {
              "TransactionNote": [
                {
                  "Title": "Processed By",
                  "Description": processedBy
                },
                {
                  "Title": "Accurate Date of Processing",
                  "Description": currentTime
                }
              ]
            }
          })),
          "action": "AddPayment"
        };

        console.log('=== Credit Payment Payload ===');
        console.log(JSON.stringify(creditPaymentPayload, null, 2));

        // Submit credit payments
        console.log('Submitting credit payments...');
        const creditResponse = await fetch(ORDER_API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(creditPaymentPayload)
        });

        creditResult = await creditResponse.json();
        console.log('=== Credit Payment API Response ===');
        console.log(JSON.stringify(creditResult, null, 2));

        if (!creditResponse.ok) {
          throw new Error(`Failed to process credit payments: ${creditResult.message || 'Unknown error'}`);
        }
      }

      // Process direct deposit payments
      if (directDepositPayments.length > 0) {
        const directDepositPayload = {
          "Payment": directDepositPayments.map(payment => ({
            "OrderID": payment.reference,
            "PaymentMethodName": "Direct Deposit",
            "CardAuthorisation": "API",
            "AmountPaid": parseFloat(payment.amount.toString()),
            "DatePaid": new Date().toISOString().split('T')[0],
            "IsCreditPayment": false,
            "TransactionNotes": {
              "TransactionNote": [
                {
                  "Title": "Processed By",
                  "Description": processedBy
                },
                {
                  "Title": "Accurate Date of Processing",
                  "Description": currentTime
                }
              ]
            }
          })),
          "action": "AddPayment"
        };

        console.log('=== Direct Deposit Payment Payload ===');
        console.log(JSON.stringify(directDepositPayload, null, 2));

        // Submit direct deposit payments
        console.log('Submitting direct deposit payments...');
        const directDepositResponse = await fetch(ORDER_API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(directDepositPayload)
        });

        directDepositResult = await directDepositResponse.json();
        console.log('=== Direct Deposit Payment API Response ===');
        console.log(JSON.stringify(directDepositResult, null, 2));

        if (!directDepositResponse.ok) {
          throw new Error(`Failed to process direct deposit payments: ${directDepositResult.message || 'Unknown error'}`);
        }
      }

      // Save payment session to Firebase
      const sessionId = await savePaymentSession(creditResult, directDepositResult, creditPayments, directDepositPayments);
      console.log('Payment session saved with ID:', sessionId);

      notification = {
        show: true,
        message: `Successfully processed ${creditPayments.length} credit payment(s) and ${directDepositPayments.length} direct deposit(s)`,
        type: 'success'
      };
    } catch (error) {
      console.error('Error:', error);
      notification = {
        show: true,
        message: error instanceof Error ? error.message : 'Failed to process payments',
        type: 'error'
      };
    } finally {
      isLoading = false;
    }
  }

  function handlePaste(event: ClipboardEvent, index: number, field: 'reference' | 'amount') {
    event.preventDefault();
    
    const clipboardData = event.clipboardData?.getData('text') || '';
    if (!clipboardData) return;

    // Split by newlines and filter out empty lines
    const lines = clipboardData
      .split(/[\n\r]/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) return;

    // Process each line
    lines.forEach((line, i) => {
      // Split by tab or multiple spaces
      const values = line.split(/[\t\s]+/).filter(val => val.length > 0);
      
      if (values.length === 0) return;

      const currentIndex = index + i;
      let currentPayment: BatchPayment;

      // If row exists, use it; otherwise create new row
      if (currentIndex < payments.length) {
        currentPayment = payments[currentIndex];
      } else {
        currentPayment = createEmptyPayment();
        payments = [...payments, currentPayment];
      }

      // Update the values based on which field was pasted into
      if (field === 'reference') {
        currentPayment.reference = values[0];
        if (values[1]) {
          const amount = parseFloat(values[1].replace(/[^0-9.-]+/g, ''));
          if (!isNaN(amount)) currentPayment.amount = amount;
        }
      } else {
        const amount = parseFloat(values[0].replace(/[^0-9.-]+/g, ''));
        if (!isNaN(amount)) currentPayment.amount = amount;
        if (values[1]) currentPayment.reference = values[1];
      }
    });

    // Update the payments array to trigger reactivity
    payments = [...payments];
  }

  function applyPaymentModeToAll() {
    if (payments.length > 0) {
      const firstPaymentMode = payments[0].paymentMode;
      payments = payments.map(payment => ({
        ...payment,
        paymentMode: firstPaymentMode
      }));
    }
  }
</script>

<div class="container mx-auto px-4 py-8" in:fade>
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">Batch Payments</h1>
    <button
      type="button"
      class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
      on:click={handleSubmit}
      disabled={isLoading}
    >
      {isLoading ? 'Submitting...' : 'Submit All Payments'}
    </button>
  </div>

  {#if notification.show}
    <div 
      class="mb-4 p-4 rounded-lg {notification.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}"
      transition:fade
    >
      {notification.message}
    </div>
  {/if}

  <table class="min-w-full bg-white">
    <thead>
      <tr>
        <th class="py-2 w-1/3">Invoice ID</th>
        <th class="py-2 w-1/3">Payment</th>
        <th class="py-2 w-1/3">
          <div class="flex items-center justify-between px-2">
            <span>Payment Mode</span>
            <button
              type="button"
              class="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded"
              on:click={applyPaymentModeToAll}
            >
              Apply to All
            </button>
          </div>
        </th>
        <th class="py-2 w-1/6">Action</th>
      </tr>
    </thead>
    <tbody>
      {#each payments as payment, index}
        <tr class="text-center" class:bg-red-100={payment.isOverCredit}>
          <td class="border px-4 py-2">
            <input
              type="text"
              bind:value={payment.reference}
              class="w-full border-none focus:ring-0 bg-transparent"
              on:paste={(event) => handlePaste(event, index, 'reference')}
              placeholder="Paste invoice IDs here..."
            />
            {#if payment.isOverCredit}
              <div class="text-xs text-red-600 mt-1">{payment.creditError}</div>
            {/if}
          </td>
          <td class="border px-4 py-2">
            <input
              type="number"
              bind:value={payment.amount}
              class="w-full border-none focus:ring-0 bg-transparent"
              min="0"
              step="0.01"
              on:paste={(event) => handlePaste(event, index, 'amount')}
              placeholder="Paste amounts here..."
            />
          </td>
          <td class="border px-4 py-2">
            <select
              bind:value={payment.paymentMode}
              class="w-full border-none focus:ring-0 bg-transparent"
            >
              <option value="Direct Deposit">Direct Deposit</option>
              <option value="Credit Payment">Credit Payment</option>
            </select>
          </td>
          <td class="border px-4 py-2">
            <button
              type="button"
              class="text-red-600 hover:text-red-800"
              on:click={() => removePayment(index)}
            >
              Remove
            </button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <div class="flex justify-start mt-4">
    <button
      type="button"
      class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      on:click={addPayment}
    >
      Add Payment
    </button>
  </div>
</div> 