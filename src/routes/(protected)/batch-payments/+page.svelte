<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { page } from '$app/stores';
  import { currentUser } from '$lib/firebase';
  import { userProfile, type UserProfile } from '$lib/userProfile';
  import { db } from '$lib/firebase';
  import { collection, addDoc, serverTimestamp, query, where, limit, getDocs } from 'firebase/firestore';

  const ORDER_API_ENDPOINT = 'https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs';

  interface BatchPayment {
    reference: string;
    amount: number;
    paymentMode: 'Direct Deposit' | 'Credit Payment';
    isOverCredit?: boolean;
    creditError?: string;
  }

  interface PaymentSession {
    sessionId: string;
    dateCreated: any; // Firebase Timestamp
    userId: string;
    userEmail: string;
    performedBy: {
      firstName: string;
      lastName: string;
    };
    payments: {
      orderId: string;
      paymentId: string;
      paymentMode: string;
      amount: number;
      dateProcessed: string;
    }[];
  }

  let user: any = null;
  let profile: UserProfile | null = null;
  let payments: BatchPayment[] = [createEmptyPayment()];
  let isLoading = false;
  let notification = { show: false, message: '', type: 'info' };
  let userSessions: PaymentSession[] = [];
  let isModalOpen = false;
  let isPaymentDetailsModalOpen = false;
  let selectedSession: PaymentSession | null = null;

  // Subscribe to user and profile changes
  const unsubUser = currentUser.subscribe(value => {
    user = value;
  });

  const unsubProfile = userProfile.subscribe(value => {
    profile = value;
  });

  onMount(() => {
    // Unsubscribe from user and profile changes when the component is destroyed
    const cleanup = () => {
      unsubUser();
      unsubProfile();
    };

    // Fetch payment sessions for the logged-in user
    const fetchUserSessions = async () => {
      if (user) {
        try {
          const q = query(
            collection(db, 'payment_sessions'),
            where('userId', '==', user.uid), // or use 'userEmail' if you prefer
            limit(5) // Limit the query to 5 documents
          );

          const querySnapshot = await getDocs(q);
          userSessions = querySnapshot.docs.map(doc => doc.data() as PaymentSession);

          console.log('User Payment Sessions:', userSessions);

          // You can now use `userSessions` to update your UI
        } catch (error) {
          console.error('Error fetching user payment sessions:', error);
        }
      }
    };

    fetchUserSessions();

    return cleanup;
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
      const uniqueUsernames = [...new Set(data.Order.map((order: any) => order.Username))];
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
        if (username && typeof username === 'string') {
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

        const { availableCredit, creditLimit, onCreditHold } = creditDetails as {
          availableCredit: number;
          creditLimit: number;
          onCreditHold: boolean;
        };
        const totalCredit = availableCredit + creditLimit;
        const totalCustomerPayments = usernameTotalPayments.get(username as string) || 0;

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

  function toggleModal() {
    isModalOpen = !isModalOpen;
    console.log('Modal toggled:', isModalOpen);
  }

  function showPaymentDetails(session: PaymentSession) {
    selectedSession = session;
    isPaymentDetailsModalOpen = true;
  }

  function closePaymentDetailsModal() {
    isPaymentDetailsModalOpen = false;
    selectedSession = null;
  }
</script>

<div class="container mx-auto px-4 py-8" in:fade>
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">Batch Payments</h1>
    <div class="flex space-x-4">
      <button
        type="button"
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        on:click={toggleModal}
      >
        Transaction History
      </button>
      <button
        type="button"
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        on:click={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? 'Submitting...' : 'Submit All Payments'}
      </button>
    </div>
  </div>

  {#if notification.show}
    <div 
      class="mb-4 p-4 rounded-lg {notification.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}"
      transition:fade
    >
      {notification.message}
    </div>
  {/if}

  <!-- Transaction History Modal -->
  {#if isModalOpen}
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" on:click={toggleModal}>
      <div class="relative top-20 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white" on:click|stopPropagation>
        <div class="mt-3">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg leading-6 font-medium text-gray-900">Transaction History</h3>
            <button
              type="button"
              class="text-gray-400 hover:text-gray-600"
              on:click={toggleModal}
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <div class="mt-2">
            {#if userSessions.length > 0}
              <div class="overflow-x-auto">
                <table class="min-w-full bg-white border border-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session ID</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Created</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performed By</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payments Count</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    {#each userSessions as session}
                      <tr class="hover:bg-gray-50">
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <button
                            type="button"
                            class="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                            on:click={() => showPaymentDetails(session)}
                          >
                            {session.sessionId || 'N/A'}
                          </button>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {session.dateCreated?.toDate ? session.dateCreated.toDate().toLocaleString() : 'N/A'}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {session.performedBy?.firstName || ''} {session.performedBy?.lastName || ''}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {session.payments?.length || 0}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${session.payments?.reduce((total, payment) => total + (payment.amount || 0), 0).toFixed(2) || '0.00'}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {:else}
              <div class="text-center py-8">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 class="mt-2 text-sm font-medium text-gray-900">No transaction history</h3>
                <p class="mt-1 text-sm text-gray-500">You haven't processed any payments yet.</p>
              </div>
            {/if}
          </div>
          <div class="flex justify-end mt-6">
            <button
              type="button"
              class="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              on:click={toggleModal}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Payment Details Modal -->
  {#if isPaymentDetailsModalOpen && selectedSession}
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" on:click={closePaymentDetailsModal}>
      <div class="relative top-20 mx-auto p-5 border w-4/5 max-w-5xl shadow-lg rounded-md bg-white" on:click|stopPropagation>
        <div class="mt-3">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h3 class="text-lg leading-6 font-medium text-gray-900">Payment Details</h3>
              <p class="text-sm text-gray-500">Session: {selectedSession.sessionId}</p>
            </div>
            <button
              type="button"
              class="text-gray-400 hover:text-gray-600"
              on:click={closePaymentDetailsModal}
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          <div class="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p class="text-sm font-medium text-gray-500">Date Created</p>
              <p class="text-sm text-gray-900">
                {selectedSession.dateCreated?.toDate ? selectedSession.dateCreated.toDate().toLocaleString() : 'N/A'}
              </p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">Performed By</p>
              <p class="text-sm text-gray-900">
                {selectedSession.performedBy?.firstName || ''} {selectedSession.performedBy?.lastName || ''}
              </p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">Total Amount</p>
              <p class="text-sm text-gray-900 font-semibold">
                ${selectedSession.payments?.reduce((total: number, payment: any) => total + (payment.amount || 0), 0).toFixed(2) || '0.00'}
              </p>
            </div>
          </div>

          <div class="mt-4">
            {#if selectedSession.payments && selectedSession.payments.length > 0}
              <div class="overflow-x-auto">
                <table class="min-w-full bg-white border border-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment ID</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Mode</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Processed</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    {#each selectedSession.payments as payment}
                      <tr class="hover:bg-gray-50">
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <a
                            href="https://www.rapidsupplies.com.au/_cpanel/salesorder/view?id={payment.orderId}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                          >
                            {payment.orderId || 'N/A'}
                          </a>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <a
                            href="https://www.rapidsupplies.com.au/_cpanel/orderpayment/view?id={payment.paymentId}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                          >
                            {payment.paymentId || 'N/A'}
                          </a>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {payment.paymentMode === 'Credit Payment' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}">
                            {payment.paymentMode || 'N/A'}
                          </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">
                          ${(payment.amount || 0).toFixed(2)}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {payment.dateProcessed ? new Date(payment.dateProcessed).toLocaleString() : 'N/A'}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {:else}
              <div class="text-center py-8">
                <p class="text-sm text-gray-500">No payment details available for this session.</p>
              </div>
            {/if}
          </div>
          
          <div class="flex justify-end mt-6">
            <button
              type="button"
              class="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              on:click={closePaymentDetailsModal}
            >
              Close
            </button>
          </div>
        </div>
      </div>
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