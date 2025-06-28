const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
};

const convertUrlsToLinks = (text) => {
    if (!text) return "";
    
    // URL regex pattern to match http/https URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    return text.replace(urlRegex, (url) => {
        const urlWithoutProtocol = url.replace("https://", "");
        return `<a href="${url}" target="_blank">${urlWithoutProtocol}</a>`; 
    });
};

const calculateInvoiceTotals = (invoiceData) => {
    const analytics = invoiceData.free_analytics ? 0 : invoiceData.mrr_analytics || 0;
    const deploymentFee = invoiceData.deployment_fee || 0;
    
    const userPrice = invoiceData.user_price || 0;
    const activeUsers = invoiceData.active_users_avg || 0;

    const employeePrice = invoiceData.employee_price || 0;
    const employeesTracked = invoiceData.employees_tracked_avg || 0;
    
    const annualInvoice = invoiceData.annual_invoice || false;
    const usersTotal = invoiceData.bill_by_user ? userPrice * activeUsers : 0;
    const employeesTotal = invoiceData.bill_by_employee ? employeePrice * employeesTracked : 0;
    
    // Calculate custom services total
    const customServicesTotal = invoiceData.custom_services.reduce((total, service) => {
        const serviceTotal = (service.price || 0) * (service.amount || 1);
        let multiplier = 1;
        
        if (annualInvoice && service.term === "monthly") {
            multiplier = 12;
        }
        
        const finalServiceTotal = serviceTotal * multiplier;
        
        // If discount is true, subtract from total; if false, add to total
        return service.discount ? total - finalServiceTotal : total + finalServiceTotal;
    }, 0);

    const oneTimeTotalFromCustomServices = invoiceData.custom_services.reduce((total, service) => {
        const serviceTotal = (service.price || 0) * (service.amount || 1);

        if (service.term === "monthly") {
            return total;
        }

        return service.discount ? total - serviceTotal : total + serviceTotal;
    }, 0);

    const monthlyTotalFromCustomServices = invoiceData.custom_services.reduce((total, service) => {
        const serviceTotal = (service.price || 0) * (service.amount || 1);

        if (service.term === "monthly") {
            return service.discount ? total - serviceTotal : total + serviceTotal;
        }

        return total;
    }, 0);
    
    const oneTimeTotal = (invoiceData.deployment_fee + oneTimeTotalFromCustomServices) || 0;
    const monthlyTotal = (usersTotal + employeesTotal + analytics + monthlyTotalFromCustomServices) || 0;
    const annualTotal = (usersTotal + employeesTotal + analytics + monthlyTotalFromCustomServices) * 12 || 0;
    const subTotal = usersTotal + employeesTotal + analytics;
    const total = deploymentFee + customServicesTotal + (annualInvoice ? subTotal * 12 : subTotal);

    return {
        oneTimeTotal,
        monthlyTotal,
        annualTotal,
        total,
    };
};

// Shared function to generate invoice data (dates, numbers, calculations)
const generateInvoiceData = (invoiceData) => {
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });

    const expirationDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const formattedExpirationDate = expirationDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
    
    const subscriptionStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const formattedSubscriptionDate = subscriptionStartDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long"
    });

    const invoiceNumber = `${currentDate.getFullYear()}${String(currentDate.getMonth() + 1).padStart(2, "0")}${String(currentDate.getDate()).padStart(2, "0")}-${invoiceData.id}`;
    const { oneTimeTotal, monthlyTotal, annualTotal, total } = calculateInvoiceTotals(invoiceData);

    return {
        formattedDate,
        formattedExpirationDate,
        formattedSubscriptionDate,
        invoiceNumber,
        oneTimeTotal,
        monthlyTotal,
        annualTotal,
        total
    };
};

// Shared function to generate invoice HTML content
const generateInvoiceHTMLContent = (invoiceData, invoiceDataCalculated) => {
    const { formattedDate, formattedExpirationDate, formattedSubscriptionDate, invoiceNumber, oneTimeTotal, monthlyTotal, annualTotal, total } = invoiceDataCalculated;

    const SERVICES = {
        "deployment_fee": {
            "name": "2025 Set-Up & Deployment Fee",
            "description": "Account creation, set-up, deployment, and employee training fee."
        },
        "analytics": {
            "name": "2025 HeavyConnect Analytics",
            "description": "HeavyConnect Analytics module monthly subscription."
        },
        "binders": {
            "name": "2025 HeavyConnect Digital Binders",
            "description": "HeavyConnect Digital Binders module monthly subscription."
        },
        "timekeeper": {
            "name": "2025 HeavyConnect TimeKeeper Pro",
            "description": `HeavyConnect TimeKeeper module monthly subscription. Includes up to ${invoiceData.active_users_avg} users licenses.`
        },
        "inspector": {
            "name": "2025 HeavyConnect Inspector Pro",
            "description": `HeavyConnect Inspector Pro module monthly subscription. Includes up to ${invoiceData.active_users_avg} users licenses.`
        },
        "training": {
            "name": "2025 HeavyConnect Training",
            "description": `HeavyConnect Training module monthly subscription. Includes up to ${invoiceData.active_users_avg} users licenses.`
        },
        "selfaudit": {
            "name": "2025 HeavyConnect Self Audit",
            "description": `HeavyConnect Self Audit module monthly subscription. Includes up to ${invoiceData.active_users_avg} users licenses.`
        }
    }
    
    return `
        <div class="header">
            <div class="header-content">
                <div class="company-info">
                    <div class="logo">
                        <img src="https://utils.heavyconnect.com/logos/icon-black.png" alt="HeavyConnect Logo">
                    </div>
                    <div class="company-details">
                        <p>HeavyConnect Inc.</p>
                        <p><a href="mailto:sales@heavyconnect.com">Sales@HeavyConnect.com</a></p>
                        <p>150 Main Street, Suite 130, Salinas, CA 93901</p>
                        <p>(833) 722-5727</p>
                    </div>
                </div>
                <div class="invoice-meta">
                    <p>Invoice Date: <span>${formattedDate}</span></p>
                    <p>Expires on: <span>${formattedExpirationDate}</span></p>
                    <p>Invoice Number: <span>${invoiceNumber}</span></p>
                    <p>Subscription Start Date: <span>${formattedSubscriptionDate}</span></p>
                </div>
            </div>
        </div>
        
        <div class="customer-section">
            <h2 class="customer-title">${invoiceData.customer_name}</h2>
            <div class="customer-details">
                <div class="customer-row">
                    <div class="customer-label">Name:</div>
                    <div class="customer-value">
                        ${invoiceData.signer_name ? `
                            <span class="customer-input">${invoiceData.signer_name}</span>
                        ` : `
                            <span class="customer-input-border"></span>
                        `}
                    </div>
                </div>
                <div class="customer-row">
                    <div class="customer-label">Title:</div>
                    <div class="customer-value">
                        ${invoiceData.signer_title ? `
                            <span class="customer-input">${invoiceData.signer_title}</span>
                        ` : `
                            <span class="customer-input-border"></span>
                        `}
                    </div>
                </div>
                <div class="customer-row">
                    <div class="customer-label">Email:</div>
                    <div class="customer-value">
                        ${invoiceData.signer_email ? `
                            <span class="customer-input">${invoiceData.signer_email}</span>
                        ` : `
                            <span class="customer-input-border"></span>
                        `}
                    </div>
                </div>
                <div class="customer-row">
                    <div class="customer-label">Phone:</div>
                    <div class="customer-value">
                        ${invoiceData.signer_phone ? `
                            <span class="customer-input">${invoiceData.signer_phone}</span>
                        ` : `
                            <span class="customer-input-border"></span>
                        `}
                    </div>
                </div>
            </div>
        </div>
        
        <table class="services-table">
            <thead>
                <tr>
                    <th>Products & Services</th>
                    <th>Description</th>
                    <th>Price</th>
                    <th>Amount</th>
                    <th>Term</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${invoiceData.deployment_fee > 0 ? `
                <tr>
                    <td>
                        <div class="service-name">${SERVICES.deployment_fee.name}</div>
                    </td>
                    <td>
                        <div class="service-description">${SERVICES.deployment_fee.description}</div>
                    </td>
                    <td class="text-center">
                        <strong>${formatCurrency(invoiceData.deployment_fee)}</strong>
                    </td>
                    <td class="text-center">
                        <strong>1</strong>
                    </td>
                    <td class="text-center">
                        <strong>One-Time</strong>
                    </td>
                    <td class="text-center">
                        <strong>${formatCurrency(invoiceData.deployment_fee)}</strong>
                    </td>
                </tr>
                ` : ""}

                ${invoiceData.mrr_analytics > 0 || invoiceData.free_analytics ? `
                <tr>
                    <td>
                        <div class="service-name">${SERVICES.analytics.name}</div>
                    </td>
                    <td>
                        <div class="service-description">${SERVICES.analytics.description}</div>
                    </td>
                    <td class="text-center">
                        <strong>${invoiceData.free_analytics ? "$0" : formatCurrency(invoiceData.mrr_analytics)}</strong>
                    </td>
                    <td class="text-center">
                        <strong>1</strong>
                    </td>
                    <td class="text-center">
                        <strong>Monthly</strong>
                    </td>
                    <td class="text-center">
                        <strong>${invoiceData.free_analytics ? "$0" : formatCurrency(invoiceData.mrr_analytics)}</strong>
                    </td>
                </tr>
                ` : ""}

                ${invoiceData.use_timekeeper ? `
                <tr>
                    <td>
                        <div class="service-name">${SERVICES.timekeeper.name}</div>
                    </td>
                    <td>
                        <div class="service-description">${SERVICES.timekeeper.description}</div>
                    </td>
                    <td class="text-center">
                        <strong>
                            ${invoiceData.free_timekeeper ? "$0" : (invoiceData.bill_by_employee ? formatCurrency(invoiceData.employee_price) : formatCurrency(invoiceData.user_price))}
                        </strong>
                    </td>
                    <td class="text-center">
                        <strong>${invoiceData.bill_by_employee ? invoiceData.employees_tracked_avg : invoiceData.active_users_avg}</strong>
                    </td>
                    <td class="text-center">
                        <strong>Monthly</strong>
                    </td>
                    <td class="text-center">
                        <strong>${invoiceData.free_timekeeper ? "$0" : (invoiceData.bill_by_employee ? formatCurrency(invoiceData.employee_price * invoiceData.employees_tracked_avg) : formatCurrency(invoiceData.user_price * invoiceData.active_users_avg))}</strong>
                    </td>
                </tr>
                ` : ""}

                ${invoiceData.use_inspector ? `
                <tr>
                    <td>
                        <div class="service-name">${SERVICES.inspector.name}</div>
                    </td>
                    <td>
                        <div class="service-description">${SERVICES.inspector.description}</div>
                    </td>
                    <td class="text-center">
                        <strong>${invoiceData.free_inspector || (invoiceData.bill_by_user && invoiceData.use_timekeeper) ? "$0" : formatCurrency(invoiceData.user_price)}</strong>
                    </td>
                    <td class="text-center">
                        <strong>${invoiceData.active_users_avg}</strong>
                    </td>
                    <td class="text-center">
                        <strong>Monthly</strong>
                    </td>
                    <td class="text-center">
                        <strong>${invoiceData.free_inspector || (invoiceData.bill_by_user && invoiceData.use_timekeeper) ? "$0" : formatCurrency(invoiceData.user_price * invoiceData.active_users_avg)}</strong>
                    </td>
                </tr>
                ` : ""}

                ${invoiceData.use_training ? `
                <tr>
                    <td>
                        <div class="service-name">${SERVICES.training.name}</div>
                    </td>
                    <td>
                        <div class="service-description">${SERVICES.training.description}</div>
                    </td>
                    <td class="text-center">
                        <strong>$0</strong>
                    </td>
                    <td class="text-center">
                        <strong>${invoiceData.active_users_avg}</strong>
                    </td>
                    <td class="text-center">
                        <strong>Monthly</strong>
                    </td>
                    <td class="text-center">
                        <strong>$0</strong>
                    </td>
                </tr>
                ` : ""}

                ${invoiceData.use_selfaudit ? `
                <tr>
                    <td>
                        <div class="service-name">${SERVICES.selfaudit.name}</div>
                    </td>
                    <td>
                        <div class="service-description">${SERVICES.selfaudit.description}</div>
                    </td>
                    <td class="text-center">
                        <strong>$0</strong>
                    </td>
                    <td class="text-center">
                        <strong>${invoiceData.active_users_avg}</strong>
                    </td>
                    <td class="text-center">
                        <strong>Monthly</strong>
                    </td>
                    <td class="text-center">
                        <strong>$0</strong>
                    </td>
                </tr>
                ` : ""}

                <tr>
                    <td>
                        <div class="service-name">${SERVICES.binders.name}</div>
                    </td>
                    <td>
                        <div class="service-description">${SERVICES.binders.description}</div>
                    </td>
                    <td class="text-center">
                        <strong>$0</strong>
                    </td>
                    <td class="text-center">
                        <strong>${invoiceData.active_users_avg}</strong>
                    </td>
                    <td class="text-center">
                        <strong>Monthly</strong>
                    </td>
                    <td class="text-center">
                        <strong>$0</strong>
                    </td>
                </tr>

                ${invoiceData.custom_services && invoiceData.custom_services.length > 0 ? 
                    invoiceData.custom_services.map(service => {
                        const serviceTotal = (service.price || 0) * (service.amount || 1);
                        const multiplier = invoiceData.annual_invoice && service.term === "monthly" ? 12 : 1;
                        const finalServiceTotal = serviceTotal * multiplier;
                        
                        return `
                        <tr class="${service.discount ? 'discount-row' : ''}">
                            <td>
                                <div class="service-name">${service.name || "Custom Service"}</div>
                            </td>
                            <td>
                                <div class="service-description">${service.description || "Custom Service"}</div>
                            </td>
                            <td class="text-center">
                                <strong>${formatCurrency(service.price || 0)}</strong>
                            </td>
                            <td class="text-center">
                                <strong>${service.amount || 1}</strong>
                            </td>
                            <td class="text-center">
                                <strong>${service.term === "monthly" ? "Monthly" : service.term === "annual" ? "Annual" : "One-Time"}</strong>
                            </td>
                            <td class="text-center">
                                <strong>${service.discount ? "-" : ""}${formatCurrency(finalServiceTotal)}</strong>
                            </td>
                        </tr>
                        `;
                    }).join("") : ""
                }
            </tbody>
        </table>
        
        <div class="totals-section">
            <div class="totals-container">
                ${oneTimeTotal > 0 ? `
                    <div class="total-row">
                        <span class="total-label">One-time subtotal:</span>
                        <span class="total-value">${formatCurrency(oneTimeTotal)}</span>
                    </div>
                ` : ""}

                ${monthlyTotal > 0 ? `
                    <div class="total-row">
                        <span class="total-label">Monthly subtotal:</span>
                        <span class="total-value">${formatCurrency(monthlyTotal)}</span>
                    </div>
                ` : ""}

                ${annualTotal > 0 && invoiceData.annual_invoice ? `
                    <div class="total-row">
                        <span class="total-label">Annual subtotal:</span>
                        <span class="total-value">${formatCurrency(annualTotal)}</span>
                    </div>
                ` : ""}

                <div class="total-row total-final">
                    <span class="total-label">Total:</span>
                    <span class="total-value">${formatCurrency(total)}</span>
                </div>
            </div>
        </div>

        <div class="terms-section">
            <h4 class="terms-title">Purchase Terms</h4>
            <div class="terms-content">
                <p>By signing this subscription agreement, you agree to use the HeavyConnect platform in accordance with HeavyConnect's Terms & Conditions.</p>
                <p>To view, click <a href="https://heavyconnect.com/index.php/terms">HeavyConnect.com/Terms</a></p>
                <p>HeavyConnect's preferred method of payment is ACH Transfer which is available without a transaction fee.</p>
                <p>We accept credit card payments which incur an additional 3% transaction fee imposed by the credit card payment processor.</p>
                <p>We accept physical check payments which incur a 1% transaction fee imposed by Intuit Quickbooks Payments.</p>
                <p>${convertUrlsToLinks(invoiceData.note)}</p>
                <p>For additional details or questions, please contact us at <a href="mailto:contact@HeavyConnect.com">Contact@HeavyConnect.com</a>.</p>
            </div>
        </div>
        
        <div class="signatures-section">
            <div class="signature-block">
                <div class="signature-table">
                    <div class="signature-row">
                        <div class="signature-label">Company:</div>
                        <div class="signature-input">
                            <span class="signature-line"></span>
                        </div>
                    </div>
                    <div class="signature-row">
                        <div class="signature-label">Name:</div>
                        <div class="signature-input">
                            <span class="signature-line"></span>
                        </div>
                    </div>
                    <div class="signature-row">
                        <div class="signature-label">Title:</div>
                        <div class="signature-input">
                            <span class="signature-line"></span>
                        </div>
                    </div>
                    <div class="signature-row">
                        <div class="signature-label">Signature:</div>
                        <div class="signature-input">
                            <span class="signature-line"></span>
                        </div>
                    </div>
                    <div class="signature-row">
                        <div class="signature-label">Date:</div>
                        <div class="signature-input">
                            <span class="signature-line"></span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="signature-block">
                <div class="signature-table">
                    <div class="signature-row">
                        <div class="signature-label">Company:</div>
                        <div class="signature-input">
                            <span class="signature-line"></span>
                        </div>
                    </div>
                    <div class="signature-row">
                        <div class="signature-label">Name:</div>
                        <div class="signature-input">
                            <span class="signature-line"></span>
                        </div>
                    </div>
                    <div class="signature-row">
                        <div class="signature-label">Title:</div>
                        <div class="signature-input">
                            <span class="signature-line"></span>
                        </div>
                    </div>
                    <div class="signature-row">
                        <div class="signature-label">Signature:</div>
                        <div class="signature-input">
                            <span class="signature-line"></span>
                        </div>
                    </div>
                    <div class="signature-row">
                        <div class="signature-label">Date:</div>
                        <div class="signature-input">
                            <span class="signature-line"></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

export function renderInvoiceHTML(invoiceData) {
    const invoiceDataCalculated = generateInvoiceData(invoiceData);
    const htmlContent = generateInvoiceHTMLContent(invoiceData, invoiceDataCalculated);

    return `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: Arial, Helvetica, sans-serif;
                        font-size: 12px;
                        line-height: 1.4;
                        color: #333;
                        background-color: white;
                        padding: 0;
                        margin: 0;
                    }
                    
                    .invoice-container {
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 30px;
                        background-color: white;
                    }
                    
                    .header {
                        border-bottom: 3px solid #2c3e50;
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    
                    .header-content {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                    }
                    
                    .company-info {
                        display: flex;
                        align-items: flex-start;
                    }
                    
                    .logo {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }

                    .logo img {
                        width: 96px;
                        height: 96px;
                        margin-right: 16px;
                    }
                    
                    .company-details p {
                        color: #7f8c8d;
                        font-size: 13px;
                        margin: 0;
                        padding: 0;
                        line-height: 1.5;
                    }
                    
                    .company-details a {
                        color: #7f8c8d;
                        text-decoration: none;
                    }
                    
                    .invoice-meta {
                        text-align: right;
                    }
                    
                    .invoice-meta p {
                        color: #7f8c8d;
                        font-size: 13px;
                        margin: 0;
                        padding: 0;
                        line-height: 1.5;
                    }
                    
                    .invoice-meta span {
                        color: #2c3e50;
                        font-weight: bold;
                    }
                    
                    .customer-section {
                        margin-bottom: 40px;
                    }
                    
                    .customer-title {
                        color: #2c3e50;
                        font-weight: bold;
                        font-size: 18px;
                        margin-bottom: 15px;
                    }
                    
                    .customer-details {
                        display: table;
                        width: 100%;
                        font-size: 13px;
                    }
                    
                    .customer-row {
                        display: table-row;
                    }
                    
                    .customer-label {
                        display: table-cell;
                        width: 64px;
                        color: #7f8c8d;
                        padding: 6px 0;
                        vertical-align: top;
                    }
                    
                    .customer-value {
                        display: table-cell;
                        padding: 6px 0;
                    }
                    
                    .customer-input {
                        color: #2c3e50;
                        font-weight: bold;
                        display: inline-block;
                        width: 300px;
                        min-width: 300px;
                        padding-bottom: 2px;
                    }

                    .customer-input-border {
                        color: #2c3e50;
                        font-weight: bold;
                        display: inline-block;
                        width: 300px;
                        min-width: 300px;
                        padding-bottom: 2px;
                        border-bottom: 1px solid #2c3e50;
                    }
                    
                    .services-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 30px;
                        font-size: 11px;
                    }
                    
                    .services-table th {
                        background-color: #34495e;
                        color: white;
                        padding: 12px 8px;
                        text-align: center;
                        border: 1px solid #ecf0f1;
                        font-weight: bold;
                        font-size: 12px;
                    }
                    
                    .services-table td {
                        padding: 10px 8px;
                        border: 1px solid #ecf0f1;
                        vertical-align: middle;
                    }
                    
                    .service-name {
                        font-weight: bold;
                        font-size: 12px;
                    }
                    
                    .service-description {
                        color: #7f8c8d;
                        font-size: 11px;
                        margin-top: 4px;
                    }
                    
                    .text-center {
                        text-align: center;
                    }
                    
                    .text-right {
                        text-align: right;
                    }
                    
                    .totals-section {
                        display: flex;
                        justify-content: flex-end;
                        margin-bottom: 40px;
                    }
                    
                    .totals-container {
                        width: 300px;
                        font-size: 13px;
                    }
                    
                    .total-row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 8px;
                    }
                    
                    .total-label {
                        color: #7f8c8d;
                    }
                    
                    .total-value {
                        color: #2c3e50;
                        font-weight: bold;
                    }
                    
                    .total-final {
                        padding-top: 15px;
                        border-top: 2px solid #ecf0f1;
                        font-size: 16px;
                    }
                    
                    .total-final .total-value {
                        font-size: 18px;
                    }
                    
                    .terms-section {
                        border-top: 1px solid #ecf0f1;
                        padding-top: 30px;
                        margin-bottom: 40px;
                    }
                    
                    .terms-title {
                        color: #2c3e50;
                        font-size: 16px;
                        font-weight: bold;
                        margin-bottom: 10px;
                    }
                    
                    .terms-content {
                        color: #7f8c8d;
                        font-size: 11px;
                        line-height: 1.6;
                    }
                    
                    .terms-content p {
                        margin: 0;
                        padding: 0;
                        margin-bottom: 6px;
                    }
                    
                    .terms-content a {
                        color: #3498db;
                        text-decoration: none;
                    }
                    
                    .signatures-section {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 40px;
                    }
                    
                    .signature-block {
                        width: 45%;
                    }
                    
                    .signature-table {
                        display: table;
                        width: 100%;
                        font-size: 12px;
                    }
                    
                    .signature-row {
                        display: table-row;
                    }
                    
                    .signature-label {
                        display: table-cell;
                        width: 80px;
                        color: #7f8c8d;
                        padding: 4px 0;
                        vertical-align: top;
                    }
                    
                    .signature-input {
                        display: table-cell;
                        padding: 4px 0;
                    }
                    
                    .signature-line {
                        color: #2c3e50;
                        font-weight: bold;
                        display: inline-block;
                        border-bottom: 1px solid #2c3e50;
                        width: 200px;
                        min-width: 200px;
                        padding-bottom: 2px;
                    }
                    
                    .discount-row {
                        color: #ff0000;
                    }
                    
                    @media print {
                        body {
                            font-size: 11px;
                        }
                        
                        .invoice-container {
                            padding: 20px;
                        }
                        
                        .services-table {
                            font-size: 10px;
                        }
                        
                        .services-table th {
                            font-size: 11px;
                        }
                        
                        .service-name {
                            font-size: 11px;
                        }
                        
                        .service-description {
                            font-size: 10px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="invoice-container">
                    ${htmlContent}
                </div>
            </body>
        </html>
    `;
};
