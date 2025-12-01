/**
 * CEBU EASTERN COLLEGE - POLICY AGREEMENT FORM
 * TypeScript Application Logic (Compiled to JavaScript)
 * 
 * Features:
 * - Form validation
 * - Google Sheets integration via Apps Script
 * - Local storage of submissions
 * - Error handling and user feedback
 */

class PolicyAgreementForm {
  constructor() {
    this.formElement = document.getElementById("policyForm");
    this.submitBtn = document.getElementById("submitBtn");
    
    // Initialize Bootstrap modals
    const submissionModalElement = document.getElementById("submissionModal");
    const errorModalElement = document.getElementById("errorModal");
    
    if (submissionModalElement) {
      this.submissionModal = new bootstrap.Modal(submissionModalElement);
    }
    
    if (errorModalElement) {
      this.errorModal = new bootstrap.Modal(errorModalElement);
    }

    this.appsScriptUrl = ""; // Will be set from config
    this.initializeEventListeners();
    this.loadSavedData();
  }

  /**
   * Initialize all event listeners
   */
  initializeEventListeners() {
    // Form submission
    this.formElement.addEventListener("submit", (e) => this.handleFormSubmit(e));

    // Final agreement checkbox - save to local storage
    const finalCheckbox = document.getElementById("check9");
    if (finalCheckbox) {
      finalCheckbox.addEventListener("change", () => this.saveFormDataLocally());
    }

    // Form input change events for auto-save
    const inputs = this.formElement.querySelectorAll(".form-control, .form-select");
    inputs.forEach((input) => {
      input.addEventListener("change", () => this.saveFormDataLocally());
    });

    // Form reset
    const resetBtn = this.formElement.querySelector('button[type="reset"]');
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        setTimeout(() => {
          this.saveFormDataLocally();
        }, 100);
      });
    }

    // Print button in modal
    const printBtn = document.getElementById("printBtn");
    if (printBtn) {
      printBtn.addEventListener("click", () => this.printModal());
    }
  }

  /**
   * Update styling for a single section based on checkbox state (removed - no longer needed)
   */
  updateSectionStyling(checkbox) {
    // No longer needed - only final checkbox exists
  }

  /**
   * Update styling for all sections (removed - no longer needed)
   */
  updateAllSectionStyling() {
    // No longer needed - only final checkbox exists
  }

  /**
   * Validate form before submission
   */
  validateForm() {
    let isValid = true;

    // Check if final agreement checkbox is checked
    const finalCheckbox = document.getElementById("check9");
    if (!finalCheckbox || !finalCheckbox.checked) {
      this.showError(
        "Incomplete Agreement",
        "Please read and check the Agreement & Acknowledgement section before submitting."
      );
      return false;
    }

    // Validate form fields using Bootstrap validation
    if (!this.formElement.checkValidity()) {
      isValid = false;
      this.formElement.classList.add("was-validated");
    }

    return isValid;
  }

  /**
   * Handle form submission
   */
  async handleFormSubmit(e) {
    e.preventDefault();

    // Validate form
    if (!this.validateForm()) {
      return;
    }

    // Disable submit button to prevent multiple submissions
    this.submitBtn.disabled = true;
    const originalText = this.submitBtn.innerHTML;
    this.submitBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Submitting...';

    try {
      // Collect form data
      const formData = this.collectFormData();

      // Generate reference ID BEFORE sending
      const referenceId = this.generateReferenceId();
      formData.referenceId = referenceId;

      // Send to Google Sheets via Apps Script
      const submitSuccess = await this.submitToGoogleSheets(formData);

      // Only show success if actually submitted to Google Sheets
      if (submitSuccess) {
        // Show success modal with all details
        this.showSuccess(referenceId, formData);

        // Clear local storage
        localStorage.removeItem("policyFormData");

        // Reset form
        this.formElement.reset();
        this.formElement.classList.remove("was-validated");
      } else {
        // Show error if submission failed
        this.showError(
          "Submission Failed",
          "Your agreement could not be submitted. Please check your internet connection and try again."
        );
      }

    } catch (error) {
      console.error("Submission error:", error);
      this.showError(
        "Submission Failed",
        error instanceof Error ? error.message : "An error occurred while submitting the form. Please try again."
      );
    } finally {
      // Re-enable submit button
      this.submitBtn.disabled = false;
      this.submitBtn.innerHTML = originalText;
    }
  }

  /**
   * Collect form data from the form
   */
  collectFormData() {
    const finalCheckbox = document.getElementById("check9");

    return {
      timestamp: new Date().toISOString(),
      studentName: document.getElementById("studentName").value,
      year: document.getElementById("year").value,
      studentId: document.getElementById("studentId").value,
      section: document.getElementById("section").value,
      email: document.getElementById("email").value,
      course: document.getElementById("course").value,
      contactInfo: document.getElementById("contactInfo").value,
      agreed: finalCheckbox ? finalCheckbox.checked : false,
      sections: this.collectPolicySections(),
    };
  }

  /**
   * Collect all policy sections text
   */
  collectPolicySections() {
    const sections = {};
    
    // Get all policy section titles and content
    const sectionElements = document.querySelectorAll('.policy-section');
    
    sectionElements.forEach((element, index) => {
      const numberElement = element.querySelector('.section-number');
      const contentElement = element.querySelector('.section-content');
      
      if (numberElement && contentElement) {
        const sectionTitle = numberElement.textContent.trim();
        const sectionContent = contentElement.textContent.trim();
        sections[`section_${index + 1}`] = {
          title: sectionTitle,
          content: sectionContent
        };
      }
    });
    
    return sections;
  }

  /**
   * Submit data to Google Sheets via Apps Script
   */
  async submitToGoogleSheets(data) {
    // Add device information to data
    data.device = this.getDeviceInfo();

    // If Apps Script URL is not configured, store locally only
    if (!this.appsScriptUrl || this.appsScriptUrl.trim() === "") {
      console.warn("Google Sheets URL not configured. Data stored locally only.");
      return false;
    }

    try {
      const response = await fetch(this.appsScriptUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      // In no-cors mode, we can't check the response content
      // But if fetch completes without error, assume success
      console.log("Data submitted to Google Sheets successfully");
      return true;

    } catch (error) {
      console.error("Submission error:", error);
      return false;
    }
  }

  /**
   * Get device information from user agent
   * Returns device type and model/OS information
   */
  getDeviceInfo() {
    const userAgent = navigator.userAgent;
    let deviceType = "Computer";
    let deviceModel = "Unknown";

    // Detect device type
    if (/android/i.test(userAgent)) {
      deviceType = "Phone";
      deviceModel = this.getAndroidVersion(userAgent);
    } else if (/iphone|ipad|ipod/i.test(userAgent)) {
      deviceType = /ipad/i.test(userAgent) ? "Tablet" : "Phone";
      deviceModel = this.getIOSVersion(userAgent);
    } else if (/windows/i.test(userAgent)) {
      deviceType = "Computer";
      deviceModel = "Windows " + this.getWindowsVersion(userAgent);
    } else if (/macintosh|mac os x/i.test(userAgent)) {
      deviceType = "Computer";
      deviceModel = "macOS " + this.getMacOSVersion(userAgent);
    } else if (/linux/i.test(userAgent)) {
      deviceType = "Computer";
      deviceModel = "Linux";
    }

    // Add browser info
    const browser = this.getBrowserInfo(userAgent);
    deviceModel = deviceModel + " - " + browser;

    return {
      type: deviceType,
      model: deviceModel
    };
  }

  /**
   * Extract Android version from user agent
   */
  getAndroidVersion(userAgent) {
    const match = userAgent.match(/Android (\d+(\.\d+)*)/);
    return match ? "Android " + match[1] : "Android";
  }

  /**
   * Extract iOS version from user agent
   */
  getIOSVersion(userAgent) {
    const match = userAgent.match(/OS (\d+_\d+)/);
    const version = match ? match[1].replace(/_/g, ".") : "";
    return "iOS " + version;
  }

  /**
   * Extract Windows version from user agent
   */
  getWindowsVersion(userAgent) {
    if (/windows nt 10.0/i.test(userAgent)) return "10/11";
    if (/windows nt 6.3/i.test(userAgent)) return "8.1";
    if (/windows nt 6.2/i.test(userAgent)) return "8";
    return "NT";
  }

  /**
   * Extract macOS version from user agent
   */
  getMacOSVersion(userAgent) {
    const match = userAgent.match(/Mac OS X (\d+_\d+)/);
    return match ? match[1].replace(/_/g, ".") : "";
  }

  /**
   * Get browser information
   */
  getBrowserInfo(userAgent) {
    if (/chrome/i.test(userAgent) && !/chromium|edg/i.test(userAgent)) return "Chrome";
    if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return "Safari";
    if (/firefox/i.test(userAgent)) return "Firefox";
    if (/edg/i.test(userAgent)) return "Edge";
    if (/trident/i.test(userAgent)) return "Internet Explorer";
    return "Other Browser";
  }

  /**
   * Save form data to local storage
   */
  saveFormDataLocally() {
    const formData = this.collectFormData();
    localStorage.setItem("policyFormData", JSON.stringify(formData));
    console.log("Form data auto-saved to local storage");
  }

  /**
   * Load previously saved form data from local storage
   */
  loadSavedData() {
    const savedData = localStorage.getItem("policyFormData");
    
    if (savedData) {
      try {
        const data = JSON.parse(savedData);

        // Populate form fields
        document.getElementById("studentName").value = data.studentName || "";
        document.getElementById("year").value = data.year || "";
        document.getElementById("studentId").value = data.studentId || "";
        document.getElementById("section").value = data.section || "";
        document.getElementById("email").value = data.email || "";

        // Restore final agreement checkbox state
        const finalCheckbox = document.getElementById("check9");
        if (finalCheckbox) {
          finalCheckbox.checked = data.agreed || false;
        }

        console.log("Previously saved form data loaded");
      } catch (error) {
        console.error("Error loading saved data:", error);
      }
    }
  }

  /**
   * Generate a unique reference ID for the submission
   */
  generateReferenceId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `CEC-PA-${timestamp}-${random}`;
  }

  /**
   * Show success modal
   */
  showSuccess(referenceId, formData) {
    // Update reference ID
    const referenceIdElement = document.getElementById("referenceId");
    if (referenceIdElement) {
      referenceIdElement.textContent = referenceId;
    }

    // Update submission details
    const studentNameElement = document.getElementById("submissionStudentName");
    if (studentNameElement && formData.studentName) {
      studentNameElement.textContent = formData.studentName;
    }

    const studentIdElement = document.getElementById("submissionStudentId");
    if (studentIdElement && formData.studentId) {
      studentIdElement.textContent = formData.studentId;
    }

    const yearElement = document.getElementById("submissionYear");
    if (yearElement && formData.year) {
      yearElement.textContent = formData.year;
    }

    const sectionElement = document.getElementById("submissionSection");
    if (sectionElement && formData.section) {
      sectionElement.textContent = formData.section;
    }

    const emailElement = document.getElementById("submissionEmail");
    if (emailElement && formData.email) {
      emailElement.textContent = formData.email;
    }

    const courseElement = document.getElementById("submissionCourse");
    if (courseElement && formData.course) {
      courseElement.textContent = formData.course;
    }

    const contactElement = document.getElementById("submissionContact");
    if (contactElement && formData.contactInfo) {
      contactElement.textContent = formData.contactInfo;
    }

    const timestampElement = document.getElementById("submissionTimestamp");
    if (timestampElement) {
      const now = new Date();
      const timestamp = now.toLocaleString();
      timestampElement.textContent = timestamp;
    }

    // Update policy sections (left column - titles only)
    const sectionsContainer = document.getElementById("submissionSectionsList");
    if (sectionsContainer && formData.sections) {
      this.populatePolicySections(sectionsContainer, formData.sections);
    }

    this.submissionModal.show();
  }

  /**
   * Populate policy sections in modal (Left column - titles only)
   */
  populatePolicySections(container, sections) {
    container.innerHTML = ''; // Clear existing content
    
    const sectionNames = {
      section_1: 'I. General Conduct',
      section_2: 'II. Laboratory Rules & Regulations',
      section_3: 'III. Classroom Rules & Conduct',
      section_4: 'IV. Data Management & Academic Integrity',
      section_5: 'V. Attendance & Punctuality',
      section_6: 'VI. Device Policies & Restrictions',
      section_7: 'VII. Consequences of Violations',
      section_8: 'VIII. Acknowledgement & Liability',
      section_9: 'IX. Agreement & Acknowledgement'
    };

    Object.entries(sections).forEach(([key, section]) => {
      const sectionDiv = document.createElement('div');
      sectionDiv.className = 'section-title-item';
      
      const title = sectionNames[key] || section.title || key;
      
      sectionDiv.innerHTML = `
        <div class="section-number-title">
          <strong>${title}</strong>
        </div>
      `;
      
      container.appendChild(sectionDiv);
    });
  }

  /**
   * Show error modal
   */
  showError(title, message) {
    const errorTitleElement = document.querySelector("#errorModalLabel");
    const errorMessageElement = document.getElementById("errorMessage");

    if (errorTitleElement) {
      errorTitleElement.textContent = `${title}`;
    }

    if (errorMessageElement) {
      errorMessageElement.textContent = message;
    }

    this.errorModal.show();
  }

  /**
   * Set the Google Apps Script URL (call this to configure the backend)
   */
  setAppsScriptUrl(url) {
    this.appsScriptUrl = url;
  }

  /**
   * Get current form data (useful for debugging)
   */
  getFormData() {
    return this.collectFormData();
  }

  /**
   * Clear all form data and local storage
   */
  clearAllData() {
    this.formElement.reset();
    localStorage.removeItem("policyFormData");
    this.formElement.classList.remove("was-validated");
  }

  /**
   * Print the submission modal
   */
  printModal() {
    const modalContent = document.querySelector('#submissionModal .modal-body');
    if (!modalContent) return;

    // Create print window
    const printWindow = window.open('', '', 'height=700,width=900');
    const printDocument = printWindow.document;

    // Write HTML for printing
    printDocument.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Policy Agreement Submission - Cebu Eastern College</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 20px;
            color: #212529;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #0056b3;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .header h2 {
            color: #0056b3;
            margin-bottom: 5px;
          }
          .header p {
            margin: 0;
            color: #666;
            font-size: 0.95rem;
          }
          .section {
            margin-bottom: 25px;
            page-break-inside: avoid;
          }
          .section-title {
            color: #0056b3;
            font-size: 1.1rem;
            font-weight: 700;
            border-left: 4px solid #0056b3;
            padding-left: 10px;
            margin-bottom: 12px;
          }
          .details-table {
            width: 100%;
            margin-bottom: 15px;
          }
          .details-table .detail-row {
            display: flex;
            padding: 8px 0;
            border-bottom: 1px solid #ddd;
          }
          .details-table .detail-label {
            font-weight: 600;
            width: 30%;
            color: #333;
          }
          .details-table .detail-value {
            width: 70%;
            word-break: break-word;
            color: #666;
          }
          .policy-sections-list {
            margin-top: 15px;
          }
          .policy-section-display {
            background: #f8f9fa;
            padding: 10px;
            margin-bottom: 10px;
            border-left: 3px solid #0056b3;
            page-break-inside: avoid;
          }
          .section-header-display {
            font-weight: 600;
            color: #0056b3;
            margin-bottom: 5px;
          }
          .section-content-display {
            font-size: 0.9rem;
            color: #666;
            line-height: 1.5;
          }
          .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 2px solid #0056b3;
            text-align: center;
            color: #666;
            font-size: 0.9rem;
          }
          @media print {
            body { margin: 0; padding: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2><i class="fas fa-check-circle"></i> Submission Confirmation</h2>
          <p>Cebu Eastern College, Inc. - College of Information Technology</p>
        </div>

        <div class="section">
          <div class="section-title">Personal Information</div>
          <div class="details-table">
            <div class="detail-row">
              <span class="detail-label">Reference ID:</span>
              <span class="detail-value">${document.getElementById('referenceId').textContent}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Student Name:</span>
              <span class="detail-value">${document.getElementById('submissionStudentName').textContent}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Student ID:</span>
              <span class="detail-value">${document.getElementById('submissionStudentId').textContent}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Year Level:</span>
              <span class="detail-value">${document.getElementById('submissionYear').textContent}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Section:</span>
              <span class="detail-value">${document.getElementById('submissionSection').textContent}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Course:</span>
              <span class="detail-value">${document.getElementById('submissionCourse').textContent}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Email:</span>
              <span class="detail-value">${document.getElementById('submissionEmail').textContent}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Contact Information:</span>
              <span class="detail-value">${document.getElementById('submissionContact').textContent}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Submission Date/Time:</span>
              <span class="detail-value">${document.getElementById('submissionTimestamp').textContent}</span>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Sections Agreed To</div>
          <div class="policy-sections-list">
            ${document.getElementById('submissionPolicySections').innerHTML}
          </div>
        </div>

        <div class="footer">
          <p>This document serves as your submission confirmation. Please keep it for your records.</p>
          <p>Printed on: ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `);

    printDocument.close();

    // Print after content loads
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }
}

// Initialize the form when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const form = new PolicyAgreementForm();

  // Configuration: Set your Google Apps Script URL here
  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzNs8UwDirv9AjR3_p_gcl2wv02bqiUPJ-uZg3GDEindO3wLpy3REp8kRtyiwCIPpYs/exec";
  form.setAppsScriptUrl(APPS_SCRIPT_URL);

  // Make form instance available globally
  window.policyForm = form;

  // Handle navbar link clicks - conditional navigation
  document.querySelectorAll('a[href*="#section"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      const isClickFromForm = e.target.closest('.policy-form') !== null;
      const currentPage = window.location.pathname;
      const isOnIndexPage = currentPage.includes('index.html') || currentPage === '/' || currentPage.endsWith('/');
      const isOnFAQPage = currentPage.includes('faqs.html');

      // If on FAQ page, navigate to index.html with anchor
      if (isOnFAQPage) {
        window.location.href = 'index.html' + href;
        return;
      }

      // If on index page and click is from within form, don't navigate
      if (isOnIndexPage && isClickFromForm) {
        e.preventDefault();
        return;
      }

      // If on index page and click is outside form, scroll to section
      if (isOnIndexPage && !isClickFromForm) {
        e.preventDefault();
        const targetId = href.substring(1);
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
          const headerHeight = document.querySelector('.formal-header').offsetHeight || 100;
          const offset = targetElement.offsetTop - headerHeight - 50;
          window.scrollTo({ top: offset, behavior: 'smooth' });
        }
      }
    });
  });

  console.log("Policy Agreement Form Initialized");
  console.log("Access form via window.policyForm");
});
