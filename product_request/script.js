// API Endpoints
const ORDER_DETAILS_API = "https://prod-29.australiasoutheast.logic.azure.com:443/workflows/0282bb0f980c4c6596ceba7d465d1269/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=FRC97yHJR3C2eV4mxLDx4Ud95WQZbihro6I6Rr58JGA";
const CUSTOMER_INFO_API = "https://prod-25.australiasoutheast.logic.azure.com:443/workflows/4f1fcf1326d54948b153273c442e8cf8/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=RAYNMIVXwsCfoqzZAQavfd01Ch07_pASYP6XGOqHd5U";
const COST_PRICE_API = "https://prod-62.australiasoutheast.logic.azure.com:443/workflows/e66b00b9cb084f5a8b7f4954526fecaa/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=CLVwwY4ZmM6CX_O-IPzgIND6QCk_C6tAaSaOwbxq6n0";
const GROUP_MAPPING_API = "https://prod-60.australiasoutheast.logic.azure.com:443/workflows/c38543a949594553b4ad99cab7dd8c00/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=411u61erX0g_vm0mpwRrWKWuzPlcio6FJlgLJEdADUo";
// Save to Maropost API Endpoint
const SAVE_TO_MAROPOST_API = "https://prod-53.australiasoutheast.logic.azure.com:443/workflows/105609f052e04dc8ab8b972bf1613942/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=TBHCbQPF_kEUBNkl-nFBDNEkooeZWc8gRINpD8PL4BE";

// Global variable to store the customer price group id from the Customer API mapping.
let globalCustomerGroupID = null;

document.addEventListener('DOMContentLoaded', () => {
  addBlinkStyle();
  document.getElementById('submitOrder').addEventListener('click', async () => {
    const orderId = document.getElementById('orderIdInput').value.trim();
    if (!orderId) {
      alert('Please enter an Order ID.');
      return;
    }
    document.getElementById('orderLineTable').style.display = 'none';
    showProgressBar();
    await callFlow(orderId);
    hideProgressBar();
    document.getElementById('orderLineTable').style.display = '';
  });

  // Toggle all checkboxes in the Save Discount Price column when header checkbox is toggled.
  document.getElementById('toggleSaveDiscount').addEventListener('change', function() {
    let checkboxes = document.querySelectorAll('#orderLineTable tbody input[type="checkbox"]');
    checkboxes.forEach(cb => {
      cb.checked = this.checked;
    });
  });

  // Handle the Apply Customer Pricing to Maropost button click.
  document.getElementById('applyPricingBtn').addEventListener('click', async function() {
    const notificationDiv = document.getElementById('maropostNotification');
    notificationDiv.textContent = "Saving to Maropost...";
    let successCount = 0;
    let failureCount = 0;
    const rows = document.querySelectorAll('#orderLineTable tbody tr');
    for (const row of rows) {
      const checkbox = row.querySelector('td:last-child input[type="checkbox"]');
      if (checkbox && checkbox.checked) {
        const sku = row.children[1].textContent.trim();
        const price = parseFloat(row.children[8].textContent);
        const maropostPayload = {
          sku: sku,
          price_group_id: globalCustomerGroupID || "2",
          price: price
        };
        try {
          const response = await fetch(SAVE_TO_MAROPOST_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(maropostPayload)
          });
          if (!response.ok) {
            failureCount++;
            console.error(`Error saving SKU: ${sku} (status: ${response.status})`);
          } else {
            const result = await response.json();
            console.log('Save to Maropost API success:', result);
            successCount++;
          }
        } catch (error) {
          console.error('Error saving product to Maropost:', error);
          failureCount++;
        }
        try {
          await createNewActivePricingRecord(sku, price, globalCustomerGroupID || "2");
        } catch (error) {
          console.error(`Error upserting Firestore pricing record for SKU: ${sku}`, error);
        }
      }
    }
    notificationDiv.textContent = `Saved ${successCount} product(s) to Maropost. ${failureCount ? failureCount + ' failure(s) occurred.' : 'All products saved successfully.'}`;
    if(successCount > 0 && failureCount === 0) {
      this.classList.add('success');
      setTimeout(() => {
        this.classList.remove('success');
      }, 2000);
    }
  });
});

function addBlinkStyle() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes blink { 0% { background-color: yellow; } 100% { background-color: transparent; } }
    .blink { animation: blink 0.5s ease-out; }
    .group-match { background-color: #c6f6d5; padding: 2px 4px; border-radius: 3px; }
    .group-mismatch { background-color: #feb2b2; padding: 2px 4px; border-radius: 3px; }
    .notification { color: #d69e2e; font-size: 14px; margin-top: 5px; padding: 5px; border: 1px solid #d69e2e; border-radius: 3px; background-color: #fefcbf; }
  `;
  document.head.appendChild(style);
}

function showProgressBar() {
  let progressBar = document.getElementById('progressBar');
  if (!progressBar) {
    progressBar = document.createElement('div');
    progressBar.id = 'progressBar';
    Object.assign(progressBar.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '0%',
      height: '5px',
      backgroundColor: 'blue',
      transition: 'width 0.3s'
    });
    document.body.appendChild(progressBar);
  }
  progressBar.style.width = '0%';
  progressBar.style.display = 'block';
  let progress = 0;
  const interval = setInterval(() => {
    progress += 10;
    if (progress >= 90) clearInterval(interval);
    progressBar.style.width = progress + '%';
  }, 300);
  progressBar.dataset.intervalId = interval;
}

function hideProgressBar() {
  const progressBar = document.getElementById('progressBar');
  if (progressBar) {
    progressBar.style.width = '100%';
    setTimeout(() => {
      progressBar.style.display = 'none';
      progressBar.style.width = '0%';
    }, 500);
  }
}

async function callFlow(orderId) {
  clearOrderInfo();
  clearTable();
  try {
    const response = await fetch(ORDER_DETAILS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId })
    });
    if (!response.ok) throw new Error(`Order API error (${response.status})`);
    const data = await response.json();
    const tablePromise = populateTable(data);
    let customerPromise = Promise.resolve();
    if (data?.Order?.length && data.Order[0].Username) {
      const orderUserGroup = data.Order[0].UserGroup || "N/A";
      customerPromise = callCustomerInfo(data.Order[0].Username, orderUserGroup);
    }
    await Promise.all([tablePromise, customerPromise]);
  } catch (error) {
    console.error(error);
  }
}

async function callCustomerInfo(username, orderUserGroup) {
  try {
    const response = await fetch(CUSTOMER_INFO_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: [username] })
    });
    if (!response.ok) throw new Error(`Customer API error (${response.status})`);
    const data = await response.json();
    displayCustomerInfo(data, orderUserGroup);
  } catch (error) {
    console.error(error);
  }
}

async function fetchGroupMapping() {
  const response = await fetch(GROUP_MAPPING_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!response.ok) throw new Error(`Group Mapping API error (${response.status})`);
  return response.json();
}

function clearOrderInfo() {
  document.getElementById('orderInfo').innerHTML = "";
}

function clearTable() {
  document.getElementById('orderLineTable').querySelector('tbody').innerHTML = "";
}

async function displayCustomerInfo(data, orderUserGroup) {
  const orderInfoDiv = document.getElementById('orderInfo');
  const applyPricingBtn = document.getElementById('applyPricingBtn');
  if (data?.Customer?.length) {
    const customer = data.Customer[0];
    const billing = customer.BillingAddress || {};
    const customerName = `${billing.BillFirstName || ""} ${billing.BillLastName || ""}`.trim();
    const customerUserGroup = customer.UserGroup || "N/A";
    try {
      const mappingArray = await fetchGroupMapping();
      const orderMapping = mappingArray.find(item => item.GroupID === orderUserGroup);
      const orderGroupName = orderMapping ? orderMapping.Group : orderUserGroup;
      const customerMapping = mappingArray.find(item => item.Group === customerUserGroup);
      const customerGroupName = customerMapping ? customerMapping.Group : customerUserGroup;
      const customerGroupID = customerMapping ? customerMapping.GroupID : "N/A";
      globalCustomerGroupID = customerGroupID;
      const groupClass = (customerMapping && customerMapping.GroupID === orderUserGroup) ? "group-match" : "group-mismatch";
      let html = `
        <div class="order-info">
          <span><strong>Customer Name:</strong> ${customerName}</span><br/>
          <span><strong>Order User Group:</strong> <span class="${groupClass}">${orderGroupName} (ID: ${orderUserGroup})</span></span><br/>
          <span><strong>Current User Group:</strong> ${customerGroupName} (ID: ${customerGroupID})</span>
        </div>`;
      if (!customerMapping || customerMapping.GroupID !== orderUserGroup) {
        html += `<div class="notification">The current user group does not match the order's user group.</div>`;
      }
      orderInfoDiv.innerHTML = html;
      if (customerGroupID === 2 || customerGroupName === "Default Client Group") {
        applyPricingBtn.disabled = true;
      } else {
        applyPricingBtn.disabled = false;
      }
    } catch (error) {
      console.error(error);
      orderInfoDiv.innerHTML = `
        <div class="order-info">
          <span><strong>Customer Name:</strong> ${customerName}</span>
          <span><strong>Current User Group:</strong> ${customerUserGroup}</span>
        </div>`;
    }
  } else {
    orderInfoDiv.innerHTML = "No customer information found.";
  }
}

function populateTable(data) {
  return new Promise((resolve) => {
    const tbody = document.getElementById('orderLineTable').querySelector('tbody');
    const costPriceMapping = {};
    const defaultPriceMapping = {};
    if (data?.Order?.length) {
      data.Order.forEach(order => {
        if (order.OrderLine?.length) {
          const sortedOrderLines = order.OrderLine.sort((a, b) => {
            const seqA = parseInt(a.OrderLineID.split('-').pop(), 10);
            const seqB = parseInt(b.OrderLineID.split('-').pop(), 10);
            return seqA - seqB;
          });
          sortedOrderLines.forEach(line => {
            const row = document.createElement('tr');
            const unitPriceNum = parseFloat(line.UnitPrice) || 0;
            const costPriceNum = parseFloat(line.CostPrice) || 0;
            const quantityNum = parseFloat(line.Quantity) || 0;
            const unitPriceRounded = unitPriceNum.toFixed(3);
            const costPriceRounded = costPriceNum.toFixed(3);
            row.appendChild(createCell(line.ProductName || "N/A"));
            row.appendChild(createCell(line.SKU || "N/A"));
            row.appendChild(createCell(line.Quantity || "N/A"));
            const costPriceCell = createCell(costPriceRounded);
            row.appendChild(costPriceCell);
            const defaultPriceCell = createCell("N/A");
            row.appendChild(defaultPriceCell);
            const unitPriceCell = createCell(unitPriceRounded);
            row.appendChild(unitPriceCell);
            const discountVal = isNaN(parseFloat(line.PercentDiscount)) ? 0 : parseFloat(line.PercentDiscount);
            const formattedDiscount = parseFloat(discountVal.toFixed(2));
            const discountCell = document.createElement('td');
            const discountInput = document.createElement('input');
            discountInput.type = 'number';
            discountInput.min = "0";
            discountInput.max = "100";
            discountInput.value = formattedDiscount;
            discountInput.style.width = "80px";
            discountInput.addEventListener('focus', function() { this.select(); });
            discountCell.appendChild(discountInput);
            row.appendChild(discountCell);
            const accumDiscountCell = createCell("N/A");
            row.appendChild(accumDiscountCell);
            const unitPriceDiscountedNum = unitPriceNum * (1 - discountVal / 100);
            const unitPriceDiscounted = unitPriceDiscountedNum.toFixed(3);
            const discountedCell = createCell(unitPriceDiscounted);
            row.appendChild(discountedCell);
            const grossProfitPercentage = unitPriceDiscountedNum > 0 
              ? (((unitPriceDiscountedNum - costPriceNum) / unitPriceDiscountedNum) * 100).toFixed(3)
              : "0.000";
            const gpPercentageCell = createCell(grossProfitPercentage);
            updateGPCellColor(gpPercentageCell, grossProfitPercentage);
            row.appendChild(gpPercentageCell);
            const totalCell = createCell((quantityNum * unitPriceDiscountedNum).toFixed(3));
            row.appendChild(totalCell);
            const saveDiscountCell = document.createElement('td');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            saveDiscountCell.appendChild(checkbox);
            row.appendChild(saveDiscountCell);
            tbody.appendChild(row);
            discountInput.addEventListener('blur', function() {
              let newDiscount = parseFloat(this.value);
              if (isNaN(newDiscount) || newDiscount < 0) newDiscount = 0;
              else if (newDiscount > 100) newDiscount = 100;
              newDiscount = parseFloat(newDiscount.toFixed(2));
              this.value = newDiscount;
              const updatedDiscountedNum = unitPriceNum * (1 - newDiscount / 100);
              const updatedDiscounted = updatedDiscountedNum.toFixed(3);
              discountedCell.textContent = updatedDiscounted;
              blinkCell(discountedCell);
              const updatedGPPercentage = updatedDiscountedNum > 0 
                ? (((updatedDiscountedNum - parseFloat(costPriceCell.textContent)) / updatedDiscountedNum) * 100).toFixed(3)
                : "0.000";
              gpPercentageCell.textContent = updatedGPPercentage;
              blinkCell(gpPercentageCell);
              updateGPCellColor(gpPercentageCell, updatedGPPercentage);
              totalCell.textContent = (quantityNum * updatedDiscountedNum).toFixed(3);
              blinkCell(totalCell);
              const defaultPriceText = defaultPriceCell.textContent;
              const rrpParsed = parseFloat(defaultPriceText.split(" ")[0]);
              if (!isNaN(rrpParsed) && rrpParsed > 0) {
                const taxedDiscountedPrice = updatedDiscountedNum * 1.1;
                const accumDiscount = ((rrpParsed - taxedDiscountedPrice) / rrpParsed) * 100;
                accumDiscountCell.textContent = accumDiscount.toFixed(2) + "%";
              } else {
                accumDiscountCell.textContent = "N/A";
              }
              blinkCell(accumDiscountCell);
            });
            const skuVal = line.SKU || "N/A";
            if (skuVal !== "N/A") {
              if (!defaultPriceMapping[skuVal]) defaultPriceMapping[skuVal] = [];
              defaultPriceMapping[skuVal].push({ defaultPriceCell, unitPriceCell, accumDiscountCell, discountedCell });
            }
            if (costPriceNum === 0 && skuVal !== "N/A") {
              if (!costPriceMapping[skuVal]) costPriceMapping[skuVal] = [];
              costPriceMapping[skuVal].push({
                costCell: costPriceCell,
                defaultPriceCell: defaultPriceCell,
                gpCell: gpPercentageCell,
                discountedCell: discountedCell
              });
            }
          });
        } else {
          const row = document.createElement('tr');
          const cell = document.createElement('td');
          cell.textContent = "No order lines found.";
          cell.colSpan = 13;
          row.appendChild(cell);
          tbody.appendChild(row);
        }
      });
    } else {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.textContent = "No orders found.";
      cell.colSpan = 13;
      row.appendChild(cell);
      tbody.appendChild(row);
    }
    
    if (Object.keys(costPriceMapping).length > 0) {
      updateCostPrices(costPriceMapping).then(() => {
        if (Object.keys(defaultPriceMapping).length > 0) {
          updateDefaultPrices(defaultPriceMapping).then(resolve);
        } else resolve();
      });
    } else {
      if (Object.keys(defaultPriceMapping).length > 0) {
        updateDefaultPrices(defaultPriceMapping).then(resolve);
      } else resolve();
    }
  });
}

async function updateCostPrices(mapping) {
  const skuList = Object.keys(mapping);
  try {
    const response = await fetch(COST_PRICE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: skuList })
    });
    if (!response.ok) throw new Error(`Cost Price API error (${response.status})`);
    const data = await response.json();
    if (data?.Item && Array.isArray(data.Item)) {
      data.Item.forEach(item => {
        const sku = item.SKU;
        const newCostPrice = parseFloat(item.DefaultPurchasePrice);
        if (mapping[sku]) {
          mapping[sku].forEach(ref => {
            ref.costCell.textContent = newCostPrice.toFixed(3);
            ref.costCell.style.backgroundColor = "rgb(255,236,160)";
            blinkCell(ref.costCell);
            const newRRP = parseFloat(item.RRP);
            ref.defaultPriceCell.textContent = newRRP.toFixed(2);
            blinkCell(ref.defaultPriceCell);
            const discountedVal = parseFloat(ref.discountedCell.textContent) || 0;
            const newGP = discountedVal > 0 
              ? (((discountedVal - newCostPrice) / discountedVal) * 100).toFixed(3)
              : "0.000";
            ref.gpCell.textContent = newGP;
            blinkCell(ref.gpCell);
            updateGPCellColor(ref.gpCell, newGP);
          });
        }
      });
    }
  } catch (error) {
    console.error(error);
  }
}

async function updateDefaultPrices(mapping) {
  const skuList = Object.keys(mapping);
  try {
    const response = await fetch(COST_PRICE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: skuList })
    });
    if (!response.ok) throw new Error(`RRP API error (${response.status})`);
    const data = await response.json();
    if (data?.Item && Array.isArray(data.Item)) {
      data.Item.forEach(item => {
        const sku = item.SKU;
        const newRRP = parseFloat(item.RRP);
        const netRRP = newRRP / 1.1;
        if (mapping[sku]) {
          mapping[sku].forEach(ref => {
            ref.defaultPriceCell.textContent = `${newRRP.toFixed(2)} (${netRRP.toFixed(2)})`;
            blinkCell(ref.defaultPriceCell);
            const unitPrice = parseFloat(ref.unitPriceCell.textContent);
            const unitPriceRounded2 = parseFloat(unitPrice.toFixed(2));
            const netRRPRounded = parseFloat(netRRP.toFixed(2));
            if (Math.abs(unitPriceRounded2 - netRRPRounded) < 0.001) {
              ref.unitPriceCell.style.backgroundColor = "rgb(189,255,204)";
            } else if (unitPriceRounded2 < netRRPRounded) {
              ref.unitPriceCell.style.backgroundColor = "rgb(206,230,255)";
            } else {
              ref.unitPriceCell.style.backgroundColor = "";
            }
            const discountedVal = parseFloat(ref.discountedCell.textContent) || 0;
            if(newRRP > 0) {
              const taxedDiscountedPrice = discountedVal * 1.1;
              const accumDiscount = ((newRRP - taxedDiscountedPrice) / newRRP) * 100;
              ref.accumDiscountCell.textContent = `${accumDiscount.toFixed(2)}%`;
            } else {
              ref.accumDiscountCell.textContent = "N/A";
            }
            blinkCell(ref.accumDiscountCell);
          });
        }
      });
    }
  } catch (error) {
    console.error(error);
  }
}

function blinkCell(cell) {
  cell.classList.add('blink');
  setTimeout(() => cell.classList.remove('blink'), 500);
}

function updateGPCellColor(cell, value) {
  cell.style.backgroundColor = parseFloat(value) < 20 ? '#ffcccc' : '';
}

function createCell(text) {
  const cell = document.createElement('td');
  cell.textContent = text;
  return cell;
}

/* ---- Updated Firebase Functions using New Neto Endpoint ---- */

// Global cache for Neto API responses
const netoAPICache = {};

async function getNetoDataForSKU(sku) {
  if (netoAPICache[sku]) {
    return netoAPICache[sku];
  }
  // New endpoint URL
  const netoUrl = "https://prod-21.australiasoutheast.logic.azure.com:443/workflows/aac65666de1841ec9537e69c137232b1/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=IAGws7ZOZR0miDvdjn1S3dC6s2VkByAqwc1wk2ds_sI";
  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json"
  };
  // New payload format: send an array of SKUs
  const payload = {
    "skus": [sku]
  };
  try {
    const response = await fetch(netoUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`Neto API request failed with status ${response.status}`);
    }
    const data = await response.json();
    if (data && data.Item && Array.isArray(data.Item)) {
      // Case-insensitive matching for SKU
      const item = data.Item.find(item => item.SKU.toString().toLowerCase() === sku.toString().toLowerCase());
      if (item) {
        netoAPICache[sku] = item;
        return item;
      }
    }
    netoAPICache[sku] = {};
    return {};
  } catch (error) {
    console.error("Error fetching Neto API data:", error);
    netoAPICache[sku] = {};
    return {};
  }
}

async function createNewActivePricingRecord(sku, price, groupId) {
  const netoData = await getNetoDataForSKU(sku);
  console.log(`Neto data for SKU ${sku}:`, netoData);
  const currentUtc = new Date().toISOString();
  const newRecord = {
    date_created: { stringValue: currentUtc },
    email: { stringValue: "" },
    group_id: { stringValue: groupId },
    price: { doubleValue: price },
    sku: { stringValue: sku },
    brand: { stringValue: netoData.Brand || "" },
    categories: { arrayValue: { values: [] } }
  };

  const categoriesArray = [];
  if (netoData.Categories && Array.isArray(netoData.Categories)) {
    const catEntry = netoData.Categories[0];
    if (catEntry && catEntry.Category) {
      let catList = catEntry.Category;
      if (!Array.isArray(catList)) {
        catList = [catList];
      }
      for (const cat of catList) {
        if (cat.CategoryID) {
          categoriesArray.push({ integerValue: parseInt(cat.CategoryID, 10) });
        }
      }
    }
  }
  newRecord.categories.arrayValue.values = categoriesArray;
  console.log(`New record for SKU ${sku}:`, newRecord);

  const queryUrl = "https://firestore.googleapis.com/v1/projects/rapidclean-ba9be/databases/(default)/documents:runQuery";
  const queryPayload = {
    structuredQuery: {
      from: [{ collectionId: "customer_group_pricing" }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            { fieldFilter: { field: { fieldPath: "sku" }, op: "EQUAL", value: { stringValue: sku } } },
            { fieldFilter: { field: { fieldPath: "group_id" }, op: "EQUAL", value: { stringValue: groupId } } }
          ]
        }
      }
    }
  };

  let existingDocumentId = null;
  let existingDocumentData = null;
  try {
    const queryResponse = await fetch(queryUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(queryPayload)
    });
    if (queryResponse.ok) {
      const queryResult = await queryResponse.json();
      if (queryResult && queryResult.length > 0 && queryResult[0].document) {
        const docName = queryResult[0].document.name;
        const segments = docName.split("/");
        existingDocumentId = segments[segments.length - 1];
        existingDocumentData = queryResult[0].document.fields;
      }
    }
  } catch (error) {
    console.error("Error querying Firestore:", error);
  }

  if (existingDocumentId && existingDocumentData) {
    const historyUrl = "https://firestore.googleapis.com/v1/projects/rapidclean-ba9be/databases/(default)/documents/customer_group_pricing_history";
    const historyPayload = {
      fields: {
        ...existingDocumentData,
        date_replaced: { stringValue: currentUtc }
      }
    };
    try {
      const historyResponse = await fetch(historyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(historyPayload)
      });
      if (!historyResponse.ok) {
        console.error(`Failed to archive record for SKU ${sku}`);
      }
    } catch (error) {
      console.error("Error archiving record:", error);
    }
    const updateUrl = `https://firestore.googleapis.com/v1/projects/rapidclean-ba9be/databases/(default)/documents/customer_group_pricing/${existingDocumentId}?updateMask.fieldPaths=date_created&updateMask.fieldPaths=email&updateMask.fieldPaths=group_id&updateMask.fieldPaths=price&updateMask.fieldPaths=sku&updateMask.fieldPaths=brand&updateMask.fieldPaths=categories`;
    try {
      const updateResponse = await fetch(updateUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: newRecord })
      });
      if (!updateResponse.ok) {
        throw new Error(`Failed to update record for SKU ${sku} with status: ${updateResponse.status}`);
      }
      const updateResult = await updateResponse.json();
      console.log("Updated Firestore record:", updateResult);
      notifyFirebaseSuccess(`Pricing record for SKU ${sku} successfully updated.`);
    } catch (error) {
      console.error("Error updating record:", error);
    }
  } else {
    const pricingUrl = "https://firestore.googleapis.com/v1/projects/rapidclean-ba9be/databases/(default)/documents/customer_group_pricing";
    try {
      const createResponse = await fetch(pricingUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: newRecord })
      });
      if (!createResponse.ok) {
        throw new Error(`Failed to create new record for SKU ${sku} with status: ${createResponse.status}`);
      }
      const createResult = await createResponse.json();
      console.log("Created new Firestore record:", createResult);
      notifyFirebaseSuccess(`Pricing record for SKU ${sku} successfully created.`);
    } catch (error) {
      console.error("Error creating new record:", error);
    }
  }
}

function notifyFirebaseSuccess(message) {
  let notificationDiv = document.getElementById('firebaseNotification');
  if (!notificationDiv) {
    notificationDiv = document.createElement('div');
    notificationDiv.id = 'firebaseNotification';
    notificationDiv.style.position = "fixed";
    notificationDiv.style.top = "10px";
    notificationDiv.style.right = "10px";
    notificationDiv.style.backgroundColor = "#d4edda";
    notificationDiv.style.color = "#155724";
    notificationDiv.style.padding = "10px";
    notificationDiv.style.border = "1px solid #c3e6cb";
    notificationDiv.style.borderRadius = "5px";
    document.body.appendChild(notificationDiv);
  }
  notificationDiv.textContent = message;
  setTimeout(() => {
    notificationDiv.textContent = "";
  }, 3000);
}
