// content.js
let scheduleMatePreferences = {
  conflictDetection: true,
  colorCoding: true,
  rmpIntegration: true,
  earlyMorningWarning: true
};

// RateMyProfessor data
let rmpData = null;

// Schedule data
let selectedSchedule = [];
let finals = [];

// Color constants
const BLUE = "rgb(207, 228, 255)";
const RED = "rgb(255, 220, 220)";
const YELLOW = "rgb(255, 244, 112)";
const GREEN = "rgb(206, 255, 206)";

// Course class for conflict detection
function Course(name, start, end, days) {
  this.name = name;
  this.days = days.replace(/,/g, '');
  this.start = start;
  this.end = end;
  this.meetings = [{ days: this.days, start: this.start, end: this.end }];
}

Course.prototype.conflicts = function(class2) {
  for (let day = 0; day < this.days.length; day++) {
    const sameDay = class2.days.includes(this.days.charAt(day));
    const sameTime = this.start <= class2.end && this.end >= class2.start;
    if (sameDay && sameTime) {
      return class2.name;
    }
  }
  return false;
}

// Final exam class for conflict detection
function Final(date, time) {
  this.name;
  this.date = date;
  this.startTime = convertTime12to24(time).hours * 100 + convertTime12to24(time).minutes;
  this.endTime = this.startTime + 200; // Assume 2 hours for final exam
}

Final.prototype.conflicts = function(final2) {
  return this.date === final2.date &&
    this.startTime <= final2.endTime && this.endTime >= final2.startTime;
}

// Helper function to convert AM/PM time to 24-hour format
function convertTime12to24(time12) {
  const [time, modifier] = time12.split(/\s*(AM|PM)/);
  let [hours, minutes] = time.split(':').map(Number);
  if (hours === 12) {
    hours = 0;
  }
  if (modifier === 'PM') {
    hours += 12;
  }
  return {
    hours: hours,
    minutes: minutes
  };
}

function parseTimeRange(timeText) {
  const [startTime12, endTime12] = timeText.split(' - ');
  const start = convertTime12to24(startTime12);
  const end = convertTime12to24(endTime12);
  return {
    start: `${start.hours.toString().padStart(2, '0')}:${start.minutes.toString().padStart(2, '0')}`,
    end: `${end.hours.toString().padStart(2, '0')}:${end.minutes.toString().padStart(2, '0')}`
  };
}

// Helper function to properly format course codes
function formatCourseCode(courseCode) {
  // Already in correct format, just trim any extra spaces and ensure proper spacing
  // For example: "ECS 122A A01" should be preserved exactly as is
  console.log(`Formatting course code: "${courseCode}"`);
  
  // The current format should already be correct from the HTML, just clean it up
  return courseCode.trim().replace(/\s+/g, ' ');
}

// Initialize extension
function initializeScheduleMate() {
  console.log('ScheduleMate: Initializing...');
  
  // Check if we're on the UC Davis Schedule Builder page
  const isScheduleBuilderPage = window.location.href.includes('my.ucdavis.edu/schedulebuilder');
  console.log(`ScheduleMate: Current URL is ${window.location.href}, isScheduleBuilderPage: ${isScheduleBuilderPage}`);
  
  // Add CSS styles for color coding (this is needed on all pages)
  addScheduleMateStyles();
  
  // Only initialize the full functionality on the schedule builder page
  if (!isScheduleBuilderPage) {
    console.log('ScheduleMate: Not on Schedule Builder page, skipping full initialization');
    return;
  }
  
  try {
  // Load saved preferences
  chrome.storage.sync.get({
    conflictDetection: true,
    colorCoding: true,
    rmpIntegration: true,
    earlyMorningWarning: true
  }, function(items) {
      if (chrome.runtime.lastError) {
        console.error('ScheduleMate: Error loading preferences', chrome.runtime.lastError);
        // Use default preferences instead
        useDefaultPreferences();
        return;
      }
      
    scheduleMatePreferences = items;
      console.log('ScheduleMate: Loaded preferences', scheduleMatePreferences);
      
      // Complete initialization
      completeInitialization();
    });
  } catch (error) {
    console.error('ScheduleMate: Extension context error', error);
    // Use default preferences as fallback
    useDefaultPreferences();
  }
}

// Use default preferences when chrome API fails
function useDefaultPreferences() {
  console.log('ScheduleMate: Using default preferences');
  scheduleMatePreferences = {
    conflictDetection: true,
    colorCoding: true,
    rmpIntegration: false, // Disable RMP by default in fallback mode
    earlyMorningWarning: true
  };
  
  // Complete initialization with defaults
  completeInitialization();
}

// Complete the initialization process
function completeInitialization() {
    // Load RateMyProfessor data if integration is enabled
    if (scheduleMatePreferences.rmpIntegration) {
      loadRMPData();
    // Note: RMP data display will be triggered by the loadRMPData function itself
    }
    
    // Load current schedule for conflict detection
    loadSchedule();
    
    // Apply color coding and other visual updates
    updateUI();
  
  // Add the sort button
  addSortButton();
  
  // Add a mutation observer to handle dynamically added content
  addDynamicContentObserver();
}

// Add mutation observer to handle dynamically added content
function addDynamicContentObserver() {
  // Create a mutation observer to watch for newly added course containers
  const observer = new MutationObserver(mutations => {
    let newCoursesAdded = false;
    
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' && mutation.addedNodes.length) {
        mutation.addedNodes.forEach(node => {
          // Check if the added node is a course container or contains one
          if (node.nodeType === 1) { // Element node
            if (node.classList && node.classList.contains('course-container')) {
              newCoursesAdded = true;
              updateCourseUI(node);
            } else if (node.querySelectorAll) {
              const coursesInNode = node.querySelectorAll('.course-container');
              if (coursesInNode.length > 0) {
                newCoursesAdded = true;
                coursesInNode.forEach(course => updateCourseUI(course));
              }
            }
          }
        });
      }
    });
    
    // If new courses were added, update RMP data
    if (newCoursesAdded && scheduleMatePreferences.rmpIntegration && rmpData) {
      displayRMPData();
    }
  });
  
  // Start observing changes to the document body
  observer.observe(document.body, { childList: true, subtree: true });
  
  console.log('ScheduleMate: Added dynamic content observer');
}

// Add CSS styles for color coding
function addScheduleMateStyles() {
  // Remove any existing styles to prevent duplicates
  const existingStyle = document.getElementById('schedule-mate-styles');
  if (existingStyle) existingStyle.remove();
  
  // Add CSS styles
  const style = document.createElement('style');
  style.id = 'schedule-mate-styles';
  style.textContent = `
    /* Course container colors */
    .schedule-mate-available {
      background-color: #dff0d8 !important;
      border-color: #d6e9c6 !important;
    }
    
    .schedule-mate-full {
      background-color: #fcf8e3 !important;
      border-color: #faebcc !important;
    }
    
    .schedule-mate-conflict {
      background-color: #f2dede !important;
      border-color: #ebccd1 !important;
    }
    
    .schedule-mate-blue {
      background-color: #d9edf7 !important;
      border-color: #bce8f1 !important;
    }
    
    /* RMP Rating styles */
    .schedule-mate-rating {
      margin-left: 8px !important;
      font-size: 12px !important;
      border-radius: 4px !important;
      padding: 2px 6px !important;
      display: inline-block !important;
      white-space: nowrap !important;
    }
    
    .schedule-mate-rating-found {
      background-color: #f8f9fa !important;
      border: 1px solid #ddd !important;
    }
    
    .schedule-mate-rating-not-found {
      background-color: #f8f9fa !important;
      border: 1px solid #ddd !important;
      opacity: 0.8 !important;
    }
    
    .schedule-mate-rating-quality {
      color: #28a745 !important;
      font-weight: bold !important;
    }
    
    .schedule-mate-rating-difficulty {
      color: #dc3545 !important;
      font-weight: bold !important;
    }
    
    .schedule-mate-take-again {
      color: #007bff !important;
      font-weight: bold !important;
    }
    
    .schedule-mate-rmp-link {
      color: #6c757d !important;
      text-decoration: none !important;
      font-weight: bold !important;
      transition: color 0.2s !important;
    }
    
    .schedule-mate-rmp-link:hover {
      color: #0056b3 !important;
      text-decoration: underline !important;
    }
    
    /* Status indicators */
    .schedule-mate-status {
      display: inline-block !important;
      margin-left: 5px !important;
      font-size: 12px !important;
      padding: 2px 6px !important;
      border-radius: 4px !important;
      font-weight: bold !important;
    }
    
    .schedule-mate-early-morning-indicator {
      background-color: #e6f7ff !important;
      border: 1px solid #91d5ff !important;
      color: #0050b3 !important;
    }
    
    .schedule-mate-late-night-indicator {
      background-color: #f9f0ff !important;
      border: 1px solid #d3adf7 !important;
      color: #531dab !important;
    }
    
    /* Sort button styling */
    .schedule-mate-sort-button {
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      background-color: #28a745 !important;
      color: white !important;
      border: none !important;
      border-radius: 50px !important;
      padding: 12px 20px !important;
      font-size: 14px !important;
      font-weight: bold !important;
      cursor: pointer !important;
      z-index: 1000 !important;
      box-shadow: 0 3px 8px rgba(0,0,0,0.3) !important;
      display: flex !important;
      align-items: center !important;
      transition: all 0.2s ease !important;
    }
    
    .schedule-mate-sort-button:hover {
      background-color: #218838 !important;
      transform: translateY(-2px) !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
    }
    
    /* Sort by Rating button styling */
    .schedule-mate-sort-rating-button {
      position: fixed !important;
      bottom: 20px !important;
      right: 210px !important; /* Adjusted position to create even spacing */
      background-color: #6c43c0 !important; /* Purple color to distinguish from other buttons */
      color: white !important;
      border: none !important;
      border-radius: 50px !important;
      padding: 12px 20px !important;
      font-size: 14px !important;
      font-weight: bold !important;
      cursor: pointer !important;
      z-index: 1000 !important;
      box-shadow: 0 3px 8px rgba(0,0,0,0.3) !important;
      display: flex !important;
      align-items: center !important;
      transition: all 0.2s ease !important;
    }
    
    .schedule-mate-sort-rating-button:hover {
      background-color: #5537a3 !important;
      transform: translateY(-2px) !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
    }
    
    .schedule-mate-sort-rating-button::before {
      content: "⭐" !important;
      margin-right: 6px !important;
      font-size: 16px !important;
    }
    
    .schedule-mate-sort-button::before {
      content: "🎨" !important;
      margin-right: 6px !important;
      font-size: 16px !important;
    }
    
    /* RMP reload button styling */
    .schedule-mate-rmp-reload-button {
      position: fixed !important;
      bottom: 20px !important;
      right: 400px !important; /* Adjusted position to create even spacing */
      background-color: #17a2b8 !important; /* Info color */
      color: white !important;
      border: none !important;
      border-radius: 50px !important;
      padding: 12px 20px !important;
      font-size: 14px !important;
      font-weight: bold !important;
      cursor: pointer !important;
      z-index: 1000 !important;
      box-shadow: 0 3px 8px rgba(0,0,0,0.3) !important;
      display: flex !important;
      align-items: center !important;
      transition: all 0.2s ease !important;
    }
    
    .schedule-mate-rmp-reload-button:hover {
      background-color: #138496 !important;
      transform: translateY(-2px) !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
    }
    
    .schedule-mate-rmp-reload-button::before {
      content: "🌙" !important;
      margin-right: 6px !important;
      font-size: 16px !important;
    }
  `;
  document.head.appendChild(style);
  console.log('ScheduleMate: Added CSS styles for color coding');
}

// Load RateMyProfessor data
function loadRMPData() {
  try {
    console.log('ScheduleMate: Loading RateMyProfessor data...');
    
    // Define promises to load both JSON files
    const loadProfessorsPromise = fetch(chrome.runtime.getURL('uc_davis_professors.json'))
    .then(response => response.json())
      .catch(error => {
        console.error('ScheduleMate: Error loading professor data:', error);
        return null;
      });
      
    const loadLegacyIdsPromise = fetch(chrome.runtime.getURL('uc_davis_legacyIds.json'))
      .then(response => response.json())
      .catch(error => {
        console.error('ScheduleMate: Error loading legacy IDs:', error);
        return null;
      });
    
    // Load both files in parallel
    Promise.all([loadProfessorsPromise, loadLegacyIdsPromise])
      .then(([professorsArray, legacyIdsArray]) => {
        if (!professorsArray && !legacyIdsArray) {
          throw new Error('Failed to load professor data files');
        }
        
        console.log(`ScheduleMate: Got professorsArray (${Array.isArray(professorsArray) ? professorsArray.length : 'not array'} items) and legacyIdsArray (${Array.isArray(legacyIdsArray) ? legacyIdsArray.length : 'not array'} items)`);
        
        // Convert the professors array to an object keyed by legacyId
        let professorsObject = {};
        if (Array.isArray(professorsArray)) {
          console.log(`ScheduleMate: Converting professors array (${professorsArray.length} items) to object`);
          professorsArray.forEach(professor => {
            if (professor && professor.legacyId) {
              professorsObject[professor.legacyId] = professor;
            }
          });
        } else {
          // If it's already an object, use it directly
          professorsObject = professorsArray || {};
        }
        
        // Convert the legacy IDs array to an object for easier lookup
        let legacyIdsObject = {};
        if (Array.isArray(legacyIdsArray)) {
          console.log(`ScheduleMate: Converting legacy IDs array (${legacyIdsArray.length} items) to object`);
          legacyIdsArray.forEach(item => {
            // Each item is an object with a single key-value pair
            const entries = Object.entries(item);
            if (entries.length > 0) {
              const [name, id] = entries[0];
              legacyIdsObject[name] = id;
              
              // Also add entries with just the email ID portion for matching professors by email
              // Extract what looks like an email ID from the name if possible
              const emailMatch = name.match(/^[a-zA-Z0-9._%+-]+(?=@|$)/);
              if (emailMatch) {
                const emailId = emailMatch[0].toLowerCase();
                if (emailId.length > 0) {
                  legacyIdsObject[emailId] = id;
                }
              }
            }
          });
        } else {
          // If it's already an object, use it directly
          legacyIdsObject = legacyIdsArray || {};
        }
        
        // Store the data for later use
        rmpData = {
          professors: professorsObject || {},
          legacyIds: legacyIdsObject
        };
        
        console.log(`ScheduleMate: RMP data loaded successfully. ${Object.keys(rmpData.professors).length} professors and ${Object.keys(rmpData.legacyIds).length} legacy IDs`);
        
        // Sample logging to verify data structure
        const professorEntries = Object.entries(rmpData.professors);
        if (professorEntries.length > 0) {
          console.log('ScheduleMate: Sample professor entries:');
          for (let i = 0; i < Math.min(3, professorEntries.length); i++) {
            const [id, data] = professorEntries[i];
            console.log(`  - ID "${id}": ${JSON.stringify(data)}`);
          }
        }
        
        // Display professor ratings on the page
        displayRMPData();
    })
    .catch(error => {
        console.error('ScheduleMate: Error processing RMP data:', error);
        useFallbackRMPData();
      });
  } catch (e) {
    console.error('ScheduleMate: Extension context error in loadRMPData:', e);
    useFallbackRMPData();
  }
}

// Display RateMyProfessor data next to professor names
function displayRMPData() {
  if (!rmpData) {
    console.log('ScheduleMate: No RMP data available to display');
    return;
  }
  
  console.log('ScheduleMate: Displaying RMP data for professors');
  console.log(`ScheduleMate: Loaded RMP data with ${Object.keys(rmpData.legacyIds).length} professors`);
  
  // Print a few example entries to verify data format
  const legacyIdEntries = Object.entries(rmpData.legacyIds);
  if (legacyIdEntries.length > 0) {
    console.log('ScheduleMate: Sample legacyIds entries:');
    for (let i = 0; i < Math.min(5, legacyIdEntries.length); i++) {
      console.log(`  - "${legacyIdEntries[i][0]}": "${legacyIdEntries[i][1]}"`);
    }
  }
  
  // Find all professor links in the course containers
  const professorLinks = document.querySelectorAll('.results-instructor a[href^="mailto:"]');
  console.log(`ScheduleMate: Found ${professorLinks.length} professor links to check for RMP data`);
  
  professorLinks.forEach(link => {
    // Get professor name from link text
    const fullName = link.textContent.trim();
    // Extract email from href to use as a unique identifier
    const email = link.getAttribute('href').replace('mailto:', '').toLowerCase();
    // Extract UCDavis email ID (part before @ucdavis.edu)
    const emailId = email.split('@')[0].toLowerCase();
    
    console.log(`ScheduleMate: Processing professor ${fullName} (${emailId})`);
    
    // Check if this professor already has RMP data displayed
    if (link.nextElementSibling && link.nextElementSibling.classList.contains('schedule-mate-rating')) {
      console.log(`ScheduleMate: Rating already exists for ${fullName}, skipping`);
      return; // Skip if already displayed
    }
    
    // First, check if we have the professor in the legacy IDs file
    const professorLegacyId = findProfessorLegacyId(fullName, emailId);
    
    if (professorLegacyId) {
      console.log(`ScheduleMate: Found legacy ID for ${fullName}: ${professorLegacyId}`);
      // If we found a legacy ID, check if we have detailed info in the professors file
      const professorInfo = findProfessorInfo(professorLegacyId);
      
      if (professorInfo) {
        console.log(`ScheduleMate: Found detailed info for ${fullName}`);
        displayProfessorInfo(link, professorInfo, professorLegacyId);
      } else {
        console.log(`ScheduleMate: No detailed info for ${fullName}, creating direct link with ID ${professorLegacyId}`);
        // We have legacy ID but no detailed info, create link to RMP
        displayRMPLink(link, fullName, professorLegacyId);
      }
    } else {
      console.log(`ScheduleMate: No legacy ID found for ${fullName}, using search link`);
      // No data found, provide direct search link
      displaySearchLink(link, fullName);
    }
  });
  
  console.log('ScheduleMate: Finished displaying RMP data');
}

// Helper function to find professor legacy ID
function findProfessorLegacyId(fullName, emailId) {
  if (!rmpData || !rmpData.legacyIds) return null;
  
  console.log(`ScheduleMate: Finding legacy ID for ${fullName} (${emailId})`);
  
  // Try to find by email ID first (most reliable)
  if (emailId && rmpData.legacyIds[emailId]) {
    console.log(`ScheduleMate: Found legacy ID for ${fullName} by email: ${emailId}`);
    return rmpData.legacyIds[emailId];
  }
  
  // Special case: check for exact match first
  for (const [professorName, legacyId] of Object.entries(rmpData.legacyIds)) {
    if (professorName.toLowerCase() === fullName.toLowerCase()) {
      console.log(`ScheduleMate: Found exact match for ${fullName}`);
      return legacyId;
    }
  }
  
  // Parse the abbreviated name if it contains a period (like "S. Saltzen")
  const nameParts = fullName.split(/\s+/);
  const isAbbreviated = nameParts.length >= 2 && nameParts[0].endsWith('.');
  
  // If it's an abbreviated name, use the new matching logic
  if (isAbbreviated) {
    const firstInitial = nameParts[0].replace('.', '').toLowerCase();
    
    // 1. For abbreviated names, get the last name (all parts after the initial)
    const lastName = nameParts.slice(1).join(' ').toLowerCase();
    console.log(`ScheduleMate: Looking for lastName "${lastName}" with firstInitial "${firstInitial}"`);
    
    // 2. Create an array to store potential matches based on last name
    const lastNameMatches = [];
    
    // First gather all professors with matching last name
    for (const [professorName, legacyId] of Object.entries(rmpData.legacyIds)) {
      const profNameParts = professorName.split(/\s+/);
      
      // Skip entries with too few parts
      if (profNameParts.length < 2) continue;
      
      // Get last name parts (everything except first name)
      const profLastName = profNameParts.slice(1).join(' ').toLowerCase();
      
      // Check if last name matches (either exact or contains)
      if (profLastName === lastName || 
          profLastName.includes(lastName) || 
          lastName.includes(profLastName)) {
        // Store this match
        lastNameMatches.push({
          fullName: professorName,
          firstName: profNameParts[0].toLowerCase(),
          lastName: profLastName,
          legacyId: legacyId
        });
      }
    }
    
    console.log(`ScheduleMate: Found ${lastNameMatches.length} professors with matching last name "${lastName}"`);
    
    // 3. If we have matches based on last name, filter by first initial
    if (lastNameMatches.length > 0) {
      // First try exact match on first initial
      for (const match of lastNameMatches) {
        if (match.firstName.startsWith(firstInitial)) {
          console.log(`ScheduleMate: Found match with exact first initial: ${match.fullName} (${match.legacyId})`);
          return match.legacyId;
        }
      }
      
      // If no match on first initial or no first initial provided, just return the first last name match
      // This handles cases where the first initial might be wrong but last name is unique enough
      console.log(`ScheduleMate: No first initial match, using first last name match: ${lastNameMatches[0].fullName} (${lastNameMatches[0].legacyId})`);
      return lastNameMatches[0].legacyId;
    }
    
    // Special cases for compound or hyphenated names
    // Special case for Porquet-Lupine, Sadoghi Hamedani, and other known hyphenated names
    if (fullName.includes('Porquet') || fullName.includes('Lupine')) {
      for (const [professorName, legacyId] of Object.entries(rmpData.legacyIds)) {
        if (professorName.toLowerCase().includes('porquet') ||
            professorName.toLowerCase().includes('lupine')) {
          console.log(`ScheduleMate: Found special case match for Porquet-Lupine: ${professorName}`);
          return legacyId;
        }
      }
    }
    if (fullName.includes('Sadoghi') || fullName.includes('Hamedani')) {
      for (const [professorName, legacyId] of Object.entries(rmpData.legacyIds)) {
        if (professorName.toLowerCase().includes('sadoghi') ||
            professorName.toLowerCase().includes('hamedani')) {
          console.log(`ScheduleMate: Found special case match for Sadoghi Hamedani: ${professorName}`);
          return legacyId;
        }
      }
    }
    
    // For names that might be challenging to match, let's try a more flexible approach
    // Try to find any professors whose last name contains any significant part of our last name
    for (let i = 1; i < nameParts.length; i++) {
      const partialLastName = nameParts[i].toLowerCase();
      
      // Skip if too short
      if (partialLastName.length <= 2) continue;
      
      for (const [professorName, legacyId] of Object.entries(rmpData.legacyIds)) {
        const profNameParts = professorName.split(/\s+/);
        
        // Skip if there aren't enough parts or the first part doesn't match initial
        if (profNameParts.length < 2) continue;
        if (!profNameParts[0].toLowerCase().startsWith(firstInitial)) continue;
        
        // Check if any part of the professor name contains this partial last name
        let lastNameMatched = false;
        for (let j = 1; j < profNameParts.length; j++) {
          const profLastNamePart = profNameParts[j].toLowerCase();
          if (profLastNamePart.includes(partialLastName) || 
              partialLastName.includes(profLastNamePart)) {
            lastNameMatched = true;
            break;
          }
        }
        
        if (lastNameMatched) {
          console.log(`ScheduleMate: Found flexible match for ${fullName}: ${professorName} (${legacyId})`);
          return legacyId;
        }
      }
    }
  }

  // Normalize name for comparison (fallback approach)
  const normalizedName = fullName.toLowerCase()
    .replace(/\./g, '') // Remove periods
    .replace(/\s+/g, ''); // Remove spaces
  
  for (const [key, value] of Object.entries(rmpData.legacyIds)) {
    const normalizedKey = key.toLowerCase()
      .replace(/\./g, '')
      .replace(/\s+/g, '');
    
    if (normalizedName === normalizedKey || 
        normalizedName.includes(normalizedKey) || 
        normalizedKey.includes(normalizedName)) {
      console.log(`ScheduleMate: Found legacy ID for ${fullName} by name similarity: ${key}`);
      return value;
    }
  }
  
  console.log(`ScheduleMate: No legacy ID found for ${fullName}`);
  return null;
}

// Helper function to find professor detailed info
function findProfessorInfo(legacyId) {
  if (!rmpData || !rmpData.professors || !legacyId) return null;
  
  // Find professor info by legacy ID
  return rmpData.professors[legacyId] || null;
}

// Display professor info when we have detailed data
function displayProfessorInfo(link, professorInfo, legacyId) {
  // Create rating element
  const ratingElement = document.createElement('span');
  ratingElement.className = 'schedule-mate-rating schedule-mate-rating-found';
  
  // Add quality rating
  const qualitySpan = document.createElement('span');
  qualitySpan.className = 'schedule-mate-rating-quality';
  qualitySpan.textContent = professorInfo.avgRating || 'N/A';
  qualitySpan.title = 'Professor Quality Rating';
  
  // Add difficulty rating
  const difficultySpan = document.createElement('span');
  difficultySpan.className = 'schedule-mate-rating-difficulty';
  difficultySpan.textContent = professorInfo.avgDifficulty || 'N/A';
  difficultySpan.title = 'Course Difficulty Rating';
  
  // Create RMP link
  const rmpLink = document.createElement('a');
  rmpLink.href = `https://www.ratemyprofessors.com/professor/${legacyId}`;
  rmpLink.target = '_blank';
  rmpLink.className = 'schedule-mate-rmp-link';
  rmpLink.textContent = 'RMP';
  rmpLink.title = 'View on RateMyProfessors.com';
  
  // Add would take again percentage if available
  if (professorInfo.wouldTakeAgainPercent) {
    const takeAgainPercent = parseFloat(professorInfo.wouldTakeAgainPercent);
    if (!isNaN(takeAgainPercent)) {
      const takeAgainSpan = document.createElement('span');
      takeAgainSpan.className = 'schedule-mate-take-again';
      takeAgainSpan.textContent = `${takeAgainPercent}%`;
      takeAgainSpan.title = 'Would Take Again Percentage';
      
      // Add the take again percentage to the rating element
      ratingElement.appendChild(qualitySpan);
      ratingElement.appendChild(document.createTextNode(' / '));
      ratingElement.appendChild(difficultySpan);
      
      if (takeAgainPercent > 0) {
        ratingElement.appendChild(document.createTextNode(' | '));
        ratingElement.appendChild(takeAgainSpan);
      }
    }
  } else {
    // Just add quality and difficulty
    ratingElement.appendChild(qualitySpan);
    ratingElement.appendChild(document.createTextNode(' / '));
    ratingElement.appendChild(difficultySpan);
  }
  
  // Add the RMP link
  ratingElement.appendChild(document.createTextNode(' | '));
  ratingElement.appendChild(rmpLink);
  
  // Insert after professor link
  link.parentNode.insertBefore(ratingElement, link.nextSibling);
  
  console.log(`ScheduleMate: Added detailed RMP data for ${professorInfo.firstName} ${professorInfo.lastName}`);
}

// Display RMP link when we only have the legacy ID but no detailed info
function displayRMPLink(link, fullName, legacyId) {
  // Create element
  const ratingElement = document.createElement('span');
  ratingElement.className = 'schedule-mate-rating schedule-mate-rating-found';
  
  // Create RMP link
  const rmpLink = document.createElement('a');
  rmpLink.href = `https://www.ratemyprofessors.com/professor/${legacyId}`;
  rmpLink.target = '_blank';
  rmpLink.className = 'schedule-mate-rmp-link';
  rmpLink.textContent = 'RMP';
  rmpLink.title = 'View on RateMyProfessors.com';
  
  // Create text label
  const rmpText = document.createElement('span');
  rmpText.textContent = 'Ratings: ';
  rmpText.className = 'schedule-mate-rmp-text';
  
  // Assemble element with better styling
  ratingElement.appendChild(rmpText);
  ratingElement.appendChild(rmpLink);
  
  // Insert after professor link
  link.parentNode.insertBefore(ratingElement, link.nextSibling);
  
  console.log(`ScheduleMate: Added RMP link for ${fullName} with ID ${legacyId}`);
}

// Display search link when we have no data for this professor
function displaySearchLink(link, fullName) {
  // Create element for professors not found in our database
  const searchElement = document.createElement('span');
  searchElement.className = 'schedule-mate-rating schedule-mate-rating-not-found';
  
  // Check if we should try to extract last name for a better search
  const nameParts = fullName.split(/\s+/);
  let searchQuery;
  
  if (nameParts.length >= 2) {
    // If it's an abbreviated name like "S. Saltzen"
    if (nameParts[0].endsWith('.')) {
      // For abbreviated names, try to create a better search query
      // If we have multiple parts after the initial, include all of them as potential last name
      if (nameParts.length > 2) {
        // For compound last names like "M. Sadoghi Hamedani" or "J. Porquet-Lupine"
        searchQuery = encodeURIComponent(`${nameParts.slice(1).join(' ')} UC Davis`);
      } else {
        // Just use last name for search to increase chances of finding the professor
        searchQuery = encodeURIComponent(`${nameParts[nameParts.length - 1]} UC Davis`);
      }
    } else {
      // Use full name
      searchQuery = encodeURIComponent(`${fullName} UC Davis`);
    }
  } else {
    // Fallback to whatever name we have
    searchQuery = encodeURIComponent(`${fullName} UC Davis`);
  }
  
  // Create direct RMP search link using the school ID for UC Davis
  const rmpSearchLink = document.createElement('a');
  // Use the proper search URL for RateMyProfessors
  rmpSearchLink.href = `https://www.ratemyprofessors.com/search/teachers?query=${searchQuery}&sid=1073`;
  rmpSearchLink.target = '_blank';
  rmpSearchLink.className = 'schedule-mate-rmp-link';
  rmpSearchLink.textContent = 'Search on RMP';
  rmpSearchLink.title = 'Search for this professor on RateMyProfessors';
  
  // Assemble search element
  searchElement.appendChild(rmpSearchLink);
  
  // Insert after professor link
  link.parentNode.insertBefore(searchElement, link.nextSibling);
  
  console.log(`ScheduleMate: Added RMP search link for ${fullName} using query: ${searchQuery}`);
}

// Use fallback RMP data when fetch fails
function useFallbackRMPData() {
  console.log('ScheduleMate: Using fallback RMP data');
  try {
    // Create a minimal fallback dataset with the new structure
        rmpData = {
      professors: {
        "2021434": {
          firstName: "Example",
          lastName: "Professor",
          avgRating: "4.2",
          avgDifficulty: "3.1",
          wouldTakeAgainPercent: "85"
        }
      },
      legacyIds: {
        "exampleprofessor": "2021434"
      }
    };
    
    // Try to update UI with fallback data
        updateUI();
      } catch (e) {
    console.error('ScheduleMate: Error with fallback RMP data:', e);
    // Disable RMP integration if fallback fails
    scheduleMatePreferences.rmpIntegration = false;
      }
}

// Load current schedule for conflict detection
function loadSchedule() {
  console.log('ScheduleMate: Loading schedule...');
  selectedSchedule = [];
  finals = [];
  
  // Find all selected courses
  const selectedCourses = document.querySelectorAll('.course-container');
  console.log(`ScheduleMate: Found ${selectedCourses.length} course containers`);
  
  selectedCourses.forEach((course, index) => {
    // Check if this is in the saved courses section (not in search results)
    const isSaved = course.querySelector('.btn-success');
    if (isSaved) {
      console.log(`ScheduleMate: Processing saved course ${index + 1}`);
      
      // Get course title
      const title = course.querySelector('.results-title')?.textContent || '';
      console.log(`ScheduleMate: Course title: "${title}"`);
      
      // Get final exam info if available
      const finalExamText = course.querySelector('.more-final')?.textContent || '';
      if (finalExamText && finalExamText.includes('Final Exam:')) {
        const finalInfo = finalExamText.split('Final Exam:')[1].trim();
        const [datePart, timePart] = finalInfo.split(/\s+(?=\d+:\d+)/);
        
        if (datePart && timePart) {
          const final = new Final(datePart.trim(), timePart.trim());
          final.name = title + " Final";
          finals.push(final);
        }
      }
      
      // Get meeting times
      const meetings = course.querySelectorAll('.meeting-item');
      meetings.forEach(meeting => {
        // Get meeting details by finding the divs inside the meeting-item
        const divs = meeting.querySelectorAll('div');
        let daysText = '';
        let timeText = '';
        let location = '';
        let type = '';
        
        // Iterate through meeting divs to extract data
        divs.forEach((div, index) => {
          const text = div.textContent.trim();
          
          // Check if this contains time (contains : and AM/PM)
          if (text.match(/\d+:\d+\s*(AM|PM)/i)) {
            timeText = text;
          } 
          // Check if this contains days (M,T,W,R,F)
          else if (text.match(/^[MTWRF,\s]+$/i) || text.match(/^(Mon|Tue|Wed|Thu|Fri|M|T|W|R|F)([,\s]+)?(Mon|Tue|Wed|Thu|Fri|M|T|W|R|F)?([,\s]+)?(Mon|Tue|Wed|Thu|Fri|M|T|W|R|F)?/i)) {
            daysText = text;
            // Convert any full day names to short codes
            daysText = daysText.replace(/Monday|Mon/gi, 'M')
                               .replace(/Tuesday|Tue/gi, 'T')
                               .replace(/Wednesday|Wed/gi, 'W')
                               .replace(/Thursday|Thu/gi, 'R')
                               .replace(/Friday|Fri/gi, 'F');
          }
          // Check if this is a location (typically last div)
          else if (index === divs.length - 1 && text) {
            location = text;
          }
          // Check if this is a type (Lecture, Discussion, etc.)
          else if (text.match(/(Lecture|Discussion|Lab|Seminar)/i)) {
            type = text;
          }
        });
        
        if (timeText && daysText) {
          const timeRange = parseTimeRange(timeText);
          
          // Handle days with commas
          const days = daysText.replace(/\s+/g, '');
          
          // Convert times to numeric for comparison
          const startTimeParts = timeRange.start.split(':').map(Number);
          const endTimeParts = timeRange.end.split(':').map(Number);
          const startTime = startTimeParts[0] * 100 + startTimeParts[1];
          const endTime = endTimeParts[0] * 100 + endTimeParts[1];
          
          const newClass = new Course(title, startTime, endTime, days);
          selectedSchedule.push(newClass);
        }
      });
    }
  });
  
  console.log(`ScheduleMate: Loaded ${selectedSchedule.length} courses for conflict detection`);
}

// Update UI based on preferences
function updateUI() {
  console.log('ScheduleMate: Updating UI...');
  if (!scheduleMatePreferences.colorCoding && 
      !scheduleMatePreferences.conflictDetection && 
      !scheduleMatePreferences.rmpIntegration &&
      !scheduleMatePreferences.earlyMorningWarning) {
    console.log('ScheduleMate: All features disabled, skipping UI update');
    return;
  }
  
  // Process all course containers
  const courseContainers = document.querySelectorAll('.course-container');
  console.log(`ScheduleMate: Found ${courseContainers.length} course containers for UI update`);
  
  courseContainers.forEach((course, index) => {
    console.log(`ScheduleMate: Updating UI for course ${index + 1}`);
    updateCourseUI(course);
  });
  
  // Display RateMyProfessor data if integration is enabled
  if (scheduleMatePreferences.rmpIntegration && rmpData) {
    displayRMPData();
  }
}

// Update UI for a specific course
function updateCourseUI(course) {
  // Add a data attribute to track if this course has been processed
  if (course.hasAttribute('data-schedule-mate-processed')) {
    console.log('ScheduleMate: Skipping already processed course');
    return;
  }

  // Check if this course is already in the selected schedule
  const isSaved = course.querySelector('.btn-success');
  const titleElement = course.querySelector('.results-title');
  const originalTitle = titleElement?.textContent?.replace(/\s*\([^)]*\)\s*$/, '') || '';
  const title = originalTitle;
  const crn = course.querySelector('.results-crn')?.textContent || '';
  
  console.log(`ScheduleMate: Processing course "${title}" (CRN: ${crn}), isSaved: ${!!isSaved}`);
  
  // Check for early morning classes if that preference is enabled
  if (scheduleMatePreferences.earlyMorningWarning) {
    checkForEarlyMorningClass(course);
  }
  
  if (isSaved) {
    // Course is already in schedule - mark blue
    if (scheduleMatePreferences.colorCoding) {
      console.log(`ScheduleMate: Marking course "${title}" as blue (in schedule)`);
      
      // Remove any existing color classes first
      course.classList.remove('schedule-mate-conflict', 'schedule-mate-full', 'schedule-mate-available');
      
      // Add blue class
      course.classList.add('schedule-mate-blue');
      
      // Add status label
      addStatusLabel(course, 'IN SCHEDULE', 'schedule');
    }
    // Mark as processed
    course.setAttribute('data-schedule-mate-processed', 'true');
    return;
  }
  
  // First check if there's an existing conflict alert in the HTML
  const conflictAlert = course.querySelector('.results-alert.alert-error');
  if (conflictAlert && conflictAlert.textContent.includes('time conflict')) {
    console.log(`ScheduleMate: Found existing conflict alert: "${conflictAlert.textContent}"`);
    
    if (scheduleMatePreferences.colorCoding) {
      console.log(`ScheduleMate: Marking course as red (based on existing conflict alert)`);
      
      // Remove any existing color classes first
      course.classList.remove('schedule-mate-blue', 'schedule-mate-full', 'schedule-mate-available');
      
      // Add conflict class
      course.classList.add('schedule-mate-conflict');
      
      // Add status label
      addStatusLabel(course, 'CONFLICT', 'conflict');
    }
    
    // Mark as processed
    course.setAttribute('data-schedule-mate-processed', 'true');
    return;
  }
  
  // Get meeting times to check for conflicts
  const meetings = course.querySelectorAll('.meeting-item');
  console.log(`ScheduleMate: Found ${meetings.length} meetings for this course`);
  
  let hasConflict = false;
  let conflictName = '';
  let isFull = false;
  
  // Check if course is full
  const seatsInfo = course.querySelector('.results-seats')?.textContent || '';
  if (seatsInfo) {
    const [available] = seatsInfo.split('/').map(n => parseInt(n.trim()));
    isFull = available <= 0;
    console.log(`ScheduleMate: Course seats: ${seatsInfo}, isFull: ${isFull}`);
  }
  
  // Check for conflicts if conflict detection is enabled
  if (scheduleMatePreferences.conflictDetection) {
    console.log(`ScheduleMate: Checking for conflicts against ${selectedSchedule.length} saved courses`);
    
    meetings.forEach((meeting, idx) => {
      if (hasConflict) return;
      
      // Get meeting details by finding the divs inside the meeting-item
      const divs = meeting.querySelectorAll('div');
      console.log(`ScheduleMate: Meeting ${idx + 1} has ${divs.length} divs`);
      
      // DEBUG: Log all div contents
      divs.forEach((div, i) => {
        console.log(`ScheduleMate: Meeting ${idx + 1}, Div ${i + 1} content: "${div.textContent.trim()}"`);
      });
      
      let daysText = '';
      let timeText = '';
      
      // Iterate through meeting divs to extract data
      divs.forEach((div, index) => {
        const text = div.textContent.trim();
        
        // Check if this contains time (contains : and AM/PM)
        if (text.match(/\d+:\d+\s*(AM|PM)/i)) {
          timeText = text;
        } 
        // Check if this contains days (M,T,W,R,F)
        else if (text.match(/^[MTWRF,\s]+$/i) || text.match(/^(Mon|Tue|Wed|Thu|Fri|M|T|W|R|F)([,\s]+)?(Mon|Tue|Wed|Thu|Fri|M|T|W|R|F)?([,\s]+)?(Mon|Tue|Wed|Thu|Fri|M|T|W|R|F)?/i)) {
          daysText = text;
          // Convert any full day names to short codes
          daysText = daysText.replace(/Monday|Mon/gi, 'M')
                             .replace(/Tuesday|Tue/gi, 'T')
                             .replace(/Wednesday|Wed/gi, 'W')
                             .replace(/Thursday|Thu/gi, 'R')
                             .replace(/Friday|Fri/gi, 'F');
        }
      });
      
      console.log(`ScheduleMate: Extracted time: "${timeText}", days: "${daysText}"`);
      
      if (timeText && timeText !== 'TBA' && daysText && daysText !== 'TBA') {
        // Convert days with commas to an array of individual days
        const days = daysText.replace(/\s+/g, '').split(',');
        console.log(`ScheduleMate: Parsed days: ${JSON.stringify(days)}`);
        
        const timeRange = parseTimeRange(timeText);
        console.log(`ScheduleMate: Parsed time range: ${JSON.stringify(timeRange)}`);
        
        // Check against all saved courses
        selectedSchedule.forEach((existingCourse, courseIdx) => {
          if (hasConflict) return;
          
          console.log(`ScheduleMate: Checking against saved course ${courseIdx + 1}: "${existingCourse.name}"`);
          console.log(`ScheduleMate: Saved course days: "${existingCourse.days}", time: ${existingCourse.start}-${existingCourse.end}`);
          
          // Convert timeRange to numeric for comparison
          const startTimeParts = timeRange.start.split(':').map(Number);
          const endTimeParts = timeRange.end.split(':').map(Number);
          const startTime = startTimeParts[0] * 100 + startTimeParts[1];
          const endTime = endTimeParts[0] * 100 + endTimeParts[1];
          console.log(`ScheduleMate: Converted time: ${startTime}-${endTime}`);
          
          // Check if any days overlap
          for (let i = 0; i < days.length; i++) {
            const day = days[i];
            // Skip empty days
            if (!day) continue;
            
            console.log(`ScheduleMate: Checking day "${day}" against "${existingCourse.days}"`);
            
            // Check if this day exists in the existing course's days
            if (existingCourse.days.includes(day)) {
              console.log(`ScheduleMate: Day "${day}" matches!`);
              
              // Check time overlap
              if (startTime <= existingCourse.end && endTime >= existingCourse.start) {
                hasConflict = true;
                conflictName = existingCourse.name;
                console.log(`ScheduleMate: TIME CONFLICT DETECTED with "${conflictName}"!`);
                break;
              }
            }
          }
        });
      }
    });
  }
  
  // Update course UI based on conflict detection result
  if (hasConflict) {
    if (scheduleMatePreferences.colorCoding) {
      console.log(`ScheduleMate: Marking course as red (conflict with "${conflictName}")`);
      
      // Remove any existing color classes first
      course.classList.remove('schedule-mate-blue', 'schedule-mate-full', 'schedule-mate-available');
      
      // Add conflict class
      course.classList.add('schedule-mate-conflict');
      
      // Add status label
      addStatusLabel(course, 'CONFLICT', 'conflict');
    }
    titleElement.textContent = `${originalTitle} (${conflictName})`;
  } else if (isFull) {
    if (scheduleMatePreferences.colorCoding) {
      console.log(`ScheduleMate: Marking course as yellow (full)`);
      
      // Remove any existing color classes first
      course.classList.remove('schedule-mate-blue', 'schedule-mate-conflict', 'schedule-mate-available');
      
      // Add full class
      course.classList.add('schedule-mate-full');
      
      // Add status label
      addStatusLabel(course, 'FULL', 'full');
    }
    titleElement.textContent = `${originalTitle} (Full)`;
  } else {
    if (scheduleMatePreferences.colorCoding) {
      console.log(`ScheduleMate: Marking course as green (available)`);
      
      // Remove any existing color classes first
      course.classList.remove('schedule-mate-blue', 'schedule-mate-conflict', 'schedule-mate-full');
      
      // Add available class
      course.classList.add('schedule-mate-available');
      
      // Add status label
      addStatusLabel(course, 'AVAILABLE', 'available');
    }
  }
  
  // Mark this course as processed
  course.setAttribute('data-schedule-mate-processed', 'true');
}

// Check if a course has early morning or late night meetings
function checkForEarlyMorningClass(course) {
  const meetings = course.querySelectorAll('.meeting-item');
  let hasEarlyMorning = false;
  let hasLateNight = false;
  let earliestTime = null;
  let latestTime = null;
  
  meetings.forEach(meeting => {
    const divs = meeting.querySelectorAll('div');
    
    // Try to find time text
    let timeText = '';
    divs.forEach(div => {
      const text = div.textContent.trim();
      if (text.match(/\d+:\d+\s*(AM|PM)/i)) {
        timeText = text;
      }
    });
    
    if (timeText) {
      // Parse the start and end time
      const [startTime12, endTime12] = timeText.split(' - ');
      const startTime = convertTime12to24(startTime12);
      const endTime = convertTime12to24(endTime12);
      
      // Check if it's at or before 9 AM (9:00)
      if (startTime.hours <= 9) {
        hasEarlyMorning = true;
        
        // Track the earliest time for display
        if (!earliestTime || 
            startTime.hours < earliestTime.hours || 
            (startTime.hours === earliestTime.hours && startTime.minutes < earliestTime.minutes)) {
          earliestTime = startTime;
        }
        
        console.log(`ScheduleMate: Early morning class detected! Starts at ${startTime.hours}:${startTime.minutes.toString().padStart(2, '0')}`);
      }
      
      // Check if it's at or after 6 PM (18:00)
      if (startTime.hours >= 18) {
        hasLateNight = true;
        
        // Track the latest time for display
        if (!latestTime || 
            endTime.hours > latestTime.hours || 
            (endTime.hours === latestTime.hours && endTime.minutes > latestTime.minutes)) {
          latestTime = endTime;
        }
        
        console.log(`ScheduleMate: Late night class detected! Starts at ${startTime.hours}:${startTime.minutes.toString().padStart(2, '0')}`);
      }
    }
  });
  
  if (hasEarlyMorning && earliestTime) {
    // Format time for display
    const displayHour = earliestTime.hours % 12 || 12; // Convert 0 to 12 for 12 AM
    const amPm = earliestTime.hours < 12 ? 'AM' : 'PM';
    const formattedTime = `${displayHour}:${earliestTime.minutes.toString().padStart(2, '0')} ${amPm}`;
    
    // Create a more prominent early morning indicator
    const container = course.querySelector('.course-container') || course;
    
    // Remove any existing indicators first
    const existingIndicator = container.querySelector('.schedule-mate-early-morning-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }
    
    // Create new indicator
    const indicator = document.createElement('div');
    indicator.className = 'schedule-mate-early-morning-indicator';
    indicator.innerHTML = `⏰ Early Morning Class (${formattedTime})`;
    indicator.dataset.timeType = 'early'; // Add data attribute for filtering
    
    // Add it to the course container
    container.prepend(indicator);
    
    console.log('ScheduleMate: Added early morning indicator');
  }
  
  if (hasLateNight && latestTime) {
    // Format time for display
    const displayHour = latestTime.hours % 12 || 12; // Convert 0 to 12 for 12 AM
    const amPm = latestTime.hours < 12 ? 'AM' : 'PM';
    const formattedTime = `${displayHour}:${latestTime.minutes.toString().padStart(2, '0')} ${amPm}`;
    
    // Create a more prominent late night indicator
    const container = course.querySelector('.course-container') || course;
    
    // Remove any existing indicators first
    const existingIndicator = container.querySelector('.schedule-mate-late-night-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }
    
    // Create new indicator
    const indicator = document.createElement('div');
    indicator.className = 'schedule-mate-late-night-indicator';
    indicator.innerHTML = `🌙 Late Night Class (${formattedTime})`;
    indicator.dataset.timeType = 'late'; // Add data attribute for filtering
    
    // Add it to the course container
    container.prepend(indicator);
    
    console.log('ScheduleMate: Added late night indicator');
  }
}

// Calendar export functionality
function getQuarterDates() {
  // Look for the term selector text
  const termSelectorElement = document.getElementById('TermSelectorText2');
  if (!termSelectorElement) {
    console.log('Term selector not found, using default dates');
    return {
      startDate: '20250331', // Default: March 31, 2025 (Spring Quarter begins)
      endDate: '20250605',   // Default: June 5, 2025 (Spring Instruction ends)
      untilDate: '20250605T235959Z' // Default until date
    };
  }
  
  const termText = termSelectorElement.textContent.trim();
  console.log(`Detected term: ${termText}`);
  
  // Set dates based on academic calendar
  if (termText.includes('Spring') && termText.includes('2025')) {
    return {
      startDate: '20250331', // March 31, 2025 (Spring Instruction begins)
      endDate: '20250605',   // June 5, 2025 (Spring Instruction ends)
      untilDate: '20250605T235959Z'
    };
  } 
  else if (termText.includes('Winter') && termText.includes('2025')) {
    return {
      startDate: '20250106', // January 6, 2025 (Winter Instruction begins)
      endDate: '20250314',   // March 14, 2025 (Winter Instruction ends)
      untilDate: '20250314T235959Z'
    };
  }
  else if (termText.includes('Fall') && termText.includes('2024')) {
    return {
      startDate: '20240925', // September 25, 2024 (Fall Instruction begins)
      endDate: '20241206',   // December 6, 2024 (Fall Instruction ends)
      untilDate: '20241206T235959Z'
    };
  }
  else if (termText.includes('Fall') && termText.includes('2025')) {
    return {
      startDate: '20250924', // September 24, 2025 (Fall Instruction begins)
      endDate: '20251205',   // December 5, 2025 (Fall Instruction ends)
      untilDate: '20251205T235959Z'
    };
  }
  // Default to Spring 2025 if no match
  return {
    startDate: '20250331', // March 31, 2025 (Spring Instruction begins)
    endDate: '20250605',   // June 5, 2025 (Spring Instruction ends)
    untilDate: '20250605T235959Z'
  };
}

function extractEventsFromPage(options = {}) {
  const events = [];
  const registeredOnly = options.registeredOnly !== false; // Default to true if not specified
  console.log(`Starting extraction with registeredOnly=${registeredOnly}`);
  
  // Get quarter dates from the page or use defaults
  const quarterDates = getQuarterDates();
  console.log('Quarter dates:', quarterDates);
  
  try {
    // Find all course items that are NOT in the SaveForLaterCourses container
    const allCourseItems = document.querySelectorAll('div[id^="t"][class*="CourseItem"]');
    const courseItems = Array.from(allCourseItems).filter(item => {
      // Check if this item is inside a SaveForLaterCourses container
      return !item.closest('#SaveForLaterCourses');
    });
    
    console.log(`Found ${courseItems.length} course items (excluding saved for later courses)`);
    
    // Extract course information
    courseItems.forEach((courseItem, index) => {
      try {
        const isRegistered = courseItem.querySelector('div.statusIndicator.registered');
        if (registeredOnly && !isRegistered) {
          console.log('Skipping unregistered course');
          return;
        }
        
        const courseTitle = courseItem.querySelector('.classTitle')?.textContent?.trim();
        if (!courseTitle) return;
        
        // Clean up HTML entities in the title (e.g., &amp; becomes &)
        const cleanCourseTitle = courseTitle.replace(/&amp;/g, '&');
        console.log(`Original course title: "${cleanCourseTitle}"`);
        
        // Extract instructor information
        const instructorDiv = courseItem.querySelector('.classDescription a[href^="mailto:"]');
        let instructorText = '';
        if (instructorDiv) {
          const name = instructorDiv.textContent.trim();
          const email = instructorDiv.getAttribute('href').replace('mailto:', '');
          instructorText = `\\nInstructor: ${name} (${email})`;
        }
        
        const [courseCode, ...titleParts] = cleanCourseTitle.split(' - ');
        console.log(`Extracted course code: "${courseCode}"`);
        
        // Format course code to include section number as "ECS 122A A01"
        const formattedCode = formatCourseCode(courseCode);
        console.log(`Formatted code: "${formattedCode}"`);
        
        const courseName = titleParts.join(' - ');
        
        const meetingTimesContainer = courseItem.querySelector('.data.meeting-times');
        if (meetingTimesContainer) {
          const meetings = meetingTimesContainer.querySelectorAll('.meeting.clearfix');
          
          meetings.forEach(meeting => {
            const elements = meeting.querySelectorAll('.float-left.height-justified');
            let meetingInfo = {
              type: '',
              time: '',
              days: '',
              location: ''
            };
            
            elements.forEach((element, index) => {
              const text = element.textContent.trim();
              if (element.classList.contains('smallTitle')) {
                meetingInfo.type = text;
              } else if (text.match(/\d+:\d+/)) {
                meetingInfo.time = text;
              } else if (text.match(/^[MTWRF]+$/)) {
                meetingInfo.days = text;
              } else if (index === elements.length - 1) {
                meetingInfo.location = text;
              }
            });
            
            // Default to "Lecture" if type is not specified
            if (!meetingInfo.type) {
              meetingInfo.type = "Lecture";
            }
            
            if (meetingInfo.time && meetingInfo.days) {
              const timeRange = parseTimeRange(meetingInfo.time);
              const daysList = meetingInfo.days.split('');
              const locationText = meetingInfo.location ? 
                `\\nLocation: ${meetingInfo.location}` : '';
              
              // Use the original course code format for the summary
              console.log(`Creating event with summary: "${formattedCode} ${meetingInfo.type}"`);
              
              events.push({
                type: 'recurring',
                summary: `${formattedCode} ${meetingInfo.type}`,
                description: `${courseName}${instructorText}${locationText}`,
                location: meetingInfo.location || '',
                startTime: timeRange.start,
                endTime: timeRange.end,
                days: daysList,
                quarterStart: quarterDates.startDate,
                until: quarterDates.untilDate
              });
            }
          });
        }
      } catch (courseError) {
        console.error(`Error processing course item ${index + 1}:`, courseError);
      }
    });
    
  } catch (error) {
    console.error('Error in main extraction:', error);
    throw error;
  }
  
  return events;
}

// Initialize the extension
document.addEventListener('DOMContentLoaded', initializeScheduleMate);

// Run it again after a short delay to handle dynamically loaded content
window.addEventListener('load', function() {
  console.log('ScheduleMate: Window loaded, initializing...');
  
  // First immediate run
  try {
    initializeScheduleMate();
  } catch (e) {
    console.error('ScheduleMate: Error during initial initialization', e);
  }
  
  // Then wait a bit for any dynamic content to load
  setTimeout(() => {
    console.log('ScheduleMate: Running delayed initialization...');
    try {
      initializeScheduleMate();
    } catch (e) {
      console.error('ScheduleMate: Error during delayed initialization', e);
    }
  }, 1000);
  
  // Add a flag to prevent multiple consecutive updates
  let isUpdating = false;
  let observerErrorCount = 0;
  const MAX_OBSERVER_ERRORS = 3;
  
  // Watch for DOM changes that might indicate new courses loaded
  const observer = new MutationObserver(function(mutations) {
    // Skip if we're already processing an update
    if (isUpdating) return;
    
    // Look for relevant mutations only (added course containers)
    const shouldUpdate = mutations.some(mutation => {
      // Check if nodes were added
      if (mutation.addedNodes.length === 0) return false;
      
      // Check if any added node is a course container or contains one
      return Array.from(mutation.addedNodes).some(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        
        if (node.classList?.contains('course-container')) return true;
        
        return node.querySelector?.('.course-container') !== null;
      });
    });
    
    if (shouldUpdate) {
      console.log('ScheduleMate: New course elements detected, reinitializing...');
      isUpdating = true;
      
      // Reset processing state for all courses
      resetProcessingState();
      
      // Run the update
      try {
        initializeScheduleMate();
      } catch (e) {
        console.error('ScheduleMate: Error in mutation observer update', e);
        observerErrorCount++;
        
        // If we get too many errors, disconnect the observer
        if (observerErrorCount >= MAX_OBSERVER_ERRORS) {
          console.error('ScheduleMate: Too many errors, disconnecting observer');
          observer.disconnect();
        }
      }
      
      // Allow updates again after a short delay
      setTimeout(() => {
        isUpdating = false;
      }, 500);
    }
  });
  
  // Start observing with a try-catch to handle any errors
  try {
    observer.observe(document.body, { childList: true, subtree: true });
  } catch (e) {
    console.error('ScheduleMate: Error setting up observer', e);
  }
  
  // Cleanup function to disconnect observer if extension context becomes invalid
  function cleanup() {
    try {
      observer.disconnect();
      console.log('ScheduleMate: Observer disconnected during cleanup');
    } catch (e) {
      console.error('ScheduleMate: Error during observer cleanup', e);
    }
  }
  
  // Try to register cleanup
  try {
    window.addEventListener('beforeunload', cleanup);
    if (chrome.runtime?.onSuspend) {
      chrome.runtime.onSuspend.addListener(cleanup);
    }
  } catch (e) {
    console.error('ScheduleMate: Error setting up cleanup', e);
  }
});

// Reset processing state for all courses
function resetProcessingState() {
  // Remove the processed flag from all course containers
  document.querySelectorAll('.course-container[data-schedule-mate-processed]').forEach(course => {
    course.removeAttribute('data-schedule-mate-processed');
  });
  console.log('ScheduleMate: Reset processing state for all courses');
}

// Message listener for the export functionality
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractEvents') {
    try {
      const events = extractEventsFromPage({
        debug: request.debug,
        registeredOnly: request.registeredOnly
      });
      
      if (events.length > 0) {
        sendResponse({ events });
      } else {
        sendResponse({ error: 'No courses found on the page' });
      }
    } catch (error) {
      console.error('Error during extraction:', error);
      sendResponse({ error: error.message });
    }
  } else if (request.action === 'applyPreferences') {
    // Update preferences
    scheduleMatePreferences = request.preferences;
    console.log('ScheduleMate: Preferences updated', scheduleMatePreferences);
    
    // Apply the new preferences
    updateUI();
    
    // Refresh buttons based on new preferences
    addSortButton();
    
    // Send success response
    sendResponse({ success: true });
  }
  return true;
});

// Add a status label to a course
function addStatusLabel(course, text, type) {
  // Remove any existing status labels
  const existingLabels = course.querySelectorAll('.schedule-mate-status-label');
  existingLabels.forEach(label => label.remove());
  
  // Create the status label
  const label = document.createElement('div');
  label.className = `schedule-mate-status-label schedule-mate-status-${type}`;
  label.textContent = text;
  
  // Add it to the course
  course.appendChild(label);
}

// Add sort button to the page
function addSortButton() {
  // Remove any existing sort buttons
  const existingButton = document.querySelector('.schedule-mate-sort-button');
  if (existingButton) existingButton.remove();
  
  const existingRatingButton = document.querySelector('.schedule-mate-sort-rating-button');
  if (existingRatingButton) existingRatingButton.remove();
  
  // Add color sorting button if color coding is enabled
  if (scheduleMatePreferences.colorCoding) {
    const sortButton = document.createElement('button');
    sortButton.className = 'schedule-mate-sort-button';
    sortButton.textContent = 'Sort by Color';
    sortButton.addEventListener('click', sortCoursesByColor);
    
    document.body.appendChild(sortButton);
    console.log('ScheduleMate: Added sort by color button');
  }
  
  // Add rating sorting button if RMP integration is enabled
  if (scheduleMatePreferences.rmpIntegration) {
    const sortRatingButton = document.createElement('button');
    sortRatingButton.className = 'schedule-mate-sort-rating-button';
    sortRatingButton.textContent = 'Sort by Rating';
    sortRatingButton.addEventListener('click', sortCoursesByRating);
    
    document.body.appendChild(sortRatingButton);
    console.log('ScheduleMate: Added sort by rating button');
  }
  
  // Add RMP reload button if RMP integration is enabled
  if (scheduleMatePreferences.rmpIntegration) {
    addRMPReloadButton();
  }
}

// Add button to hide early/late classes
function addRMPReloadButton() {
  // Remove any existing RMP reload buttons
  const existingButton = document.querySelector('.schedule-mate-rmp-reload-button');
  if (existingButton) existingButton.remove();
  
  // Remove any existing browse buttons
  const existingBrowseButton = document.querySelector('.schedule-mate-browse-rmp-button');
  if (existingBrowseButton) existingBrowseButton.remove();
  
  // Create hide early/late classes button
  const hideButton = document.createElement('button');
  hideButton.className = 'schedule-mate-rmp-reload-button'; // Reuse the same class for positioning
  hideButton.textContent = 'Hide Early/Late Classes';
  hideButton.title = 'Hide or show early morning and late night classes';
  
  // Track state
  hideButton.dataset.hidden = 'false';
  
  hideButton.addEventListener('click', () => {
    const isHidden = hideButton.dataset.hidden === 'true';
    
    // Toggle state
    hideButton.dataset.hidden = isHidden ? 'false' : 'true';
    hideButton.textContent = isHidden ? 'Hide Early/Late Classes' : 'Show Early/Late Classes';
    
    // Check if classes are already fully loaded
    const totalClassesOnPage = document.querySelectorAll('.course-container').length;
    let allClassesLoaded = false;
    
    // If we have a significant number of classes already loaded, assume they're all loaded
    // This threshold could be adjusted based on experience
    if (totalClassesOnPage > 50) {
      allClassesLoaded = true;
      console.log(`ScheduleMate: Detected ${totalClassesOnPage} classes already loaded, skipping loading step`);
    }
    
    if (allClassesLoaded) {
      // Skip loading and directly toggle visibility
      console.log('ScheduleMate: Classes already loaded, proceeding with toggle');
      showNotification(isHidden ? 'Showing all classes...' : 'Hiding early/late classes...', 3000);
      toggleEarlyLateClasses(!isHidden);
      
      // Scroll back to the top of the page
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    } else {
      // Show loading notification
      showNotification(isHidden ? 'Loading all classes and showing them...' : 'Loading all classes and hiding early/late ones...', 3000);
      
      // Load all classes, then toggle visibility
      forceLoadAllCourses()
        .then(() => {
          console.log('ScheduleMate: All classes loaded, now toggling early/late classes');
          // Toggle visibility of early/late classes
          toggleEarlyLateClasses(!isHidden); // !isHidden because we're toggling to the new state
          
          // Scroll back to the top of the page
          window.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
          
          // Show confirmation notification
          showNotification(isHidden ? 'Showing all classes' : 'Hiding early morning and late night classes', 3000);
        })
        .catch(error => {
          console.error('ScheduleMate: Error loading all classes:', error);
          // Try to toggle with what we have available
          toggleEarlyLateClasses(!isHidden);
          
          // Scroll back to the top of the page
          window.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
          
          // Show notification
          showNotification(isHidden ? 
            'Showing all currently loaded classes' : 
            'Hiding early/late classes that are currently loaded', 3000);
        });
    }
  });
  
  document.body.appendChild(hideButton);
  console.log('ScheduleMate: Added Hide Early/Late Classes button');
}

// Toggle visibility of early/late classes
function toggleEarlyLateClasses(hide) {
  // Find all courses with early/late indicators
  const earlyIndicators = document.querySelectorAll('.schedule-mate-early-morning-indicator');
  const lateIndicators = document.querySelectorAll('.schedule-mate-late-night-indicator');
  
  let earlyCount = 0;
  let lateCount = 0;
  
  // Function to toggle a course container
  const toggleCourse = (indicator, hide) => {
    // Try multiple approaches to find the course container
    
    // Approach 1: Using closest
    let courseContainer = indicator.closest('.course-container');
    
    // Approach 2: If closest fails, try walking up the DOM tree
    if (!courseContainer) {
      let parent = indicator.parentElement;
      const maxDepth = 10; // Prevent infinite loops
      let depth = 0;
      
      while (parent && depth < maxDepth) {
        // Check if this element or any of its children has the course-container class
        if (parent.classList && parent.classList.contains('course-container')) {
          courseContainer = parent;
          break;
        }
        
        // Also check for common course container identifiers
        if (parent.querySelector && (
            parent.querySelector('.results-title') || 
            parent.querySelector('.meeting-item') ||
            parent.querySelector('.results-seats'))) {
          courseContainer = parent;
          break;
        }
        
        parent = parent.parentElement;
        depth++;
      }
    }
    
    // If we found a container, toggle its visibility
    if (courseContainer) {
      if (hide) {
        // Ensure we're hiding the topmost container that represents a course
        // Sometimes the course container might be nested in another element
        let topContainer = courseContainer;
        let parent = courseContainer.parentElement;
        
        // Try to find if the course is part of a larger container
        while (parent && parent !== document.body) {
          // If parent contains multiple course containers, we don't want to hide the parent
          if (parent.querySelectorAll('.course-container').length > 1) {
            break;
          }
          
          // If parent looks like a course item wrapper, use that instead
          if (parent.classList && (
              parent.classList.contains('course-item') ||
              parent.classList.contains('results-item') ||
              parent.classList.contains('search-result'))) {
            topContainer = parent;
          }
          
          parent = parent.parentElement;
        }
        
        // Apply hiding to the topmost appropriate container
        topContainer.style.display = 'none';
        topContainer.dataset.scheduleMateSuppressed = 'true';
      } else {
        // When showing, find all suppressed elements
        const suppressedElements = document.querySelectorAll('[data-schedule-mate-suppressed="true"]');
        suppressedElements.forEach(element => {
          element.style.display = '';
          delete element.dataset.scheduleMateSuppressed;
        });
        
        // Also ensure this specific container is shown
        courseContainer.style.display = '';
        delete courseContainer.dataset.scheduleMateSuppressed;
      }
      return true; // Successfully toggled
    }
    
    return false; // Failed to find container
  };
  
  if (!hide) {
    // When showing, it's more efficient to just show all suppressed elements at once
    const suppressedElements = document.querySelectorAll('[data-schedule-mate-suppressed="true"]');
    suppressedElements.forEach(element => {
      element.style.display = '';
      delete element.dataset.scheduleMateSuppressed;
    });
    
    earlyCount = earlyIndicators.length;
    lateCount = lateIndicators.length;
  } else {
    // Toggle early morning classes
    earlyIndicators.forEach(indicator => {
      if (toggleCourse(indicator, hide)) {
        earlyCount++;
      }
    });
    
    // Toggle late night classes
    lateIndicators.forEach(indicator => {
      if (toggleCourse(indicator, hide)) {
        lateCount++;
      }
    });
  }
  
  console.log(`ScheduleMate: ${hide ? 'Hid' : 'Showed'} ${earlyCount} early and ${lateCount} late classes`);
}

// Clear existing RMP data displays
function clearRMPDisplays() {
  // Remove all RMP rating displays
  const ratings = document.querySelectorAll('.schedule-mate-rating');
  ratings.forEach(rating => rating.remove());
  console.log(`ScheduleMate: Cleared ${ratings.length} RMP displays`);
}

// Sort courses by their color status
function sortCoursesByColor() {
  console.log('ScheduleMate: Sorting courses by color...');
  
  // Check if classes are already fully loaded
  const totalClassesOnPage = document.querySelectorAll('.course-container').length;
  let allClassesLoaded = false;
  
  // If we have a significant number of classes already loaded, assume they're all loaded
  // This threshold could be adjusted based on experience
  if (totalClassesOnPage > 50) {
    allClassesLoaded = true;
    console.log(`ScheduleMate: Detected ${totalClassesOnPage} classes already loaded, skipping loading step`);
  }
  
  if (allClassesLoaded) {
    // Skip loading and directly process and sort courses
    console.log('ScheduleMate: Classes already loaded, proceeding with sorting');
    showNotification('Sorting classes by color...', 3000);
    processSortCourses();
  } else {
    // Show loading notification
    showNotification('Loading all courses...', 60000); // Long timeout in case loading takes time
    
    // First, try to force load all content by scrolling to the bottom
    forceLoadAllCourses()
      .then(() => {
        // Then process and sort all courses
        processSortCourses();
      })
      .catch(error => {
        console.error('ScheduleMate: Error loading all courses', error);
        // Try to sort anyway with what we have
        processSortCourses();
      });
  }
}

// Function to process and sort courses
function processSortCourses() {
  // Process all courses to ensure they have colors
  const courseContainers = document.querySelectorAll('.course-container');
  
  if (courseContainers.length === 0) {
    console.log('ScheduleMate: No courses found to sort');
    hideNotification();
    showNotification('No courses found to sort', 3000);
    return;
  }
  
  console.log(`ScheduleMate: Processing ${courseContainers.length} courses for sorting`);
  
  // First, ensure all courses are processed for color coding
  courseContainers.forEach(course => {
    // Remove the processed flag so it will be reprocessed
    course.removeAttribute('data-schedule-mate-processed');
    // Update UI for this course
    updateCourseUI(course);
  });
  
  // Find the parent container again after processing
  const parentContainer = courseContainers[0].parentElement;
  if (!parentContainer) {
    console.log('ScheduleMate: Cannot find parent container');
    hideNotification();
    showNotification('Error: Cannot find course container', 3000);
    return;
  }
  
  // Create an array of the course elements to sort
  const coursesArray = Array.from(courseContainers);
  
  // Define color priority (1 = highest, 4 = lowest)
  const getColorPriority = (course) => {
    if (course.classList.contains('schedule-mate-available')) return 1; // Green (Available) - highest priority
    if (course.classList.contains('schedule-mate-full')) return 2;      // Yellow (Full)
    if (course.classList.contains('schedule-mate-conflict')) return 3;  // Red (Conflict)
    if (course.classList.contains('schedule-mate-blue')) return 4;      // Blue (In Schedule) - lowest priority
    return 5; // No color class - lowest priority
  };
  
  // Sort the courses by their color priority
  coursesArray.sort((a, b) => {
    const priorityA = getColorPriority(a);
    const priorityB = getColorPriority(b);
    return priorityA - priorityB;
  });
  
  // Reorder the elements in the DOM without destroying and recreating them
  // This preserves event listeners and added elements like RMP ratings
  
  // Create a document fragment to minimize reflow
  const fragment = document.createDocumentFragment();
  
  // Append each course to the fragment in the sorted order
  coursesArray.forEach(course => {
    fragment.appendChild(course);
  });
  
  // Append all courses back to the parent container at once
  parentContainer.appendChild(fragment);
  
  // Collapse all course details to make the page more manageable
  collapseAllCourseDetails();
  
  // Scroll back to the top of the page
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
  
  console.log('ScheduleMate: Courses sorted by color successfully');
  
  // Hide loading notification and show success
  hideNotification();
  showNotification('Courses sorted by color: Available → Full → Conflict → In Schedule', 3000);
}

// Force load all courses by scrolling to the bottom
function forceLoadAllCourses() {
  return new Promise((resolve, reject) => {
    console.log('ScheduleMate: Attempting to force-load all courses...');
    
    // Save the state of expanded course details before scrolling
    saveExpandedState();
    
    // Find the main container that might have dynamic loading
    const mainContainer = document.querySelector('#CourseList') || 
                        document.querySelector('.search-results') || 
                        document.body;
    
    if (!mainContainer) {
      reject('Could not find main container');
      return;
    }
    
    // Store initial count to check if new elements are being loaded
    let initialCourseCount = document.querySelectorAll('.course-container').length;
    let previousCourseCount = initialCourseCount;
    let scrollAttempts = 0;
    const maxScrollAttempts = 20; // Maximum scroll attempts to prevent infinite loops
    
    // Create a function to scroll and check if new courses are loaded
    const scrollAndCheckForNewCourses = () => {
      // Scroll to the bottom of the container
      mainContainer.scrollTo(0, mainContainer.scrollHeight);
      document.body.scrollTo(0, document.body.scrollHeight);
      window.scrollTo(0, document.body.scrollHeight);
      
      // Wait for potential new content to load
      setTimeout(() => {
        const currentCourseCount = document.querySelectorAll('.course-container').length;
        console.log(`ScheduleMate: Courses loaded: ${currentCourseCount} (was ${previousCourseCount})`);
        
        // Collapse any newly opened details
        preventDetailExpansion();
        
        // If no new courses were loaded or we've reached the maximum attempts
        if (currentCourseCount === previousCourseCount || scrollAttempts >= maxScrollAttempts) {
          console.log(`ScheduleMate: Finished loading courses. Total: ${currentCourseCount} courses`);
          if (currentCourseCount > initialCourseCount) {
            // Successfully loaded more courses
            resolve();
          } else if (scrollAttempts >= maxScrollAttempts) {
            console.log('ScheduleMate: Reached maximum scroll attempts');
            resolve(); // Resolve anyway to continue with what we have
          } else {
            // Try a different approach or resolve with what we have
            console.log('ScheduleMate: No new courses loaded, trying a different approach');
            tryClickLoadMore();
          }
        } else {
          // New courses were loaded, continue scrolling
          previousCourseCount = currentCourseCount;
          scrollAttempts++;
          scrollAndCheckForNewCourses();
        }
      }, 1000); // Wait 1 second for content to load
    };
    
    // Function to try clicking "Load more" buttons if they exist
    const tryClickLoadMore = () => {
      // Look for common "load more" buttons
      const loadMoreButtons = document.querySelectorAll('button, .btn, .button, .load-more, [id*="load"], [class*="load"]');
      let buttonClicked = false;
      
      loadMoreButtons.forEach(button => {
        const text = button.textContent.toLowerCase();
        if (text.includes('load') || text.includes('more') || text.includes('show')) {
          console.log('ScheduleMate: Found and clicking load more button');
          button.click();
          buttonClicked = true;
        }
      });
      
      if (buttonClicked) {
        // Wait for content to load after clicking
        setTimeout(() => {
          const currentCourseCount = document.querySelectorAll('.course-container').length;
          if (currentCourseCount > previousCourseCount) {
            console.log(`ScheduleMate: Successfully loaded more courses after clicking button. Total: ${currentCourseCount}`);
          }
          resolve();
        }, 2000);
      } else {
        // No load more buttons found, just resolve with what we have
        resolve();
      }
    };
    
    // Start the scrolling process
    scrollAndCheckForNewCourses();
  });
}

// Save expanded state of course details
function saveExpandedState() {
  // Find all course details buttons/elements
  const detailsButtons = document.querySelectorAll('.course-alerts, button[title="View Course Details"], .btn-mini.white-on-navyblue');
  
  // Store their current state
  window.scheduleMateExpandedState = Array.from(detailsButtons).map(button => {
    return {
      element: button,
      expanded: button.classList.contains('open') || button.textContent.includes('Hide Details')
    };
  });
  
  console.log(`ScheduleMate: Saved expanded state for ${window.scheduleMateExpandedState.length} course details`);
}

// Prevent course details from expanding during loading
function preventDetailExpansion() {
  const detailsElements = document.querySelectorAll('.course-more-info:not(.hide), .course-details-expanded');
  
  detailsElements.forEach(element => {
    if (!element.classList.contains('hide')) {
      element.classList.add('hide');
    }
  });
  
  // Reset any opened detail buttons
  const detailsButtons = document.querySelectorAll('.course-alerts.open, button[title="View Course Details"].open, .btn-mini.white-on-navyblue:not(.closed)');
  
  detailsButtons.forEach(button => {
    if (button.classList.contains('open')) {
      button.classList.remove('open');
      button.classList.add('closed');
    }
    if (button.textContent.includes('Hide Details')) {
      button.textContent = button.textContent.replace('Hide Details', 'Show Details');
    }
  });
}

// Collapse all course details to make the page more manageable
function collapseAllCourseDetails() {
  // Find all expanded course details
  const expandedDetails = document.querySelectorAll('.course-more-info:not(.hide), .course-details-expanded');
  const expandedButtons = document.querySelectorAll('.course-alerts.open, button[title="View Course Details"].open, .btn-mini.white-on-navyblue:not(.closed)');
  
  console.log(`ScheduleMate: Collapsing ${expandedDetails.length} expanded course details`);
  
  // Hide all expanded details
  expandedDetails.forEach(details => {
    if (!details.classList.contains('hide')) {
      details.classList.add('hide');
    }
  });
  
  // Reset all detail buttons
  expandedButtons.forEach(button => {
    if (button.classList.contains('open')) {
      button.classList.remove('open');
      button.classList.add('closed');
    }
    if (button.textContent.includes('Hide Details')) {
      button.textContent = button.textContent.replace('Hide Details', 'Show Details');
    }
  });
}

// Show a notification message
function showNotification(message, duration) {
  // Remove any existing notifications
  hideNotification();
  
  // Create notification element
  const notification = document.createElement('div');
  notification.id = 'schedule-mate-notification';
  notification.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    background-color: #002855 !important;
    color: white !important;
    padding: 12px 24px !important;
    border-radius: 8px !important;
    font-weight: bold !important;
    z-index: 100000 !important; /* Extremely high z-index to ensure it's on top */
    box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
    opacity: 0 !important;
    transition: all 0.3s ease !important;
    max-width: 80% !important;
    text-align: center !important;
    pointer-events: none !important; /* Allow clicks to pass through */
    transform: translate(-50%, -10px) !important;
    border-left: 4px solid #FFBF00 !important; /* Gold accent for visibility */
    font-size: 16px !important;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Show the notification with animation
  setTimeout(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translate(-50%, 0)';
    
    // Auto-hide after duration if specified
    if (duration) {
      setTimeout(() => {
        hideNotification();
      }, duration);
    }
  }, 50);
}

// Hide notification
function hideNotification() {
  const notification = document.getElementById('schedule-mate-notification');
  if (notification) {
    notification.style.opacity = '0';
    notification.style.transform = 'translate(-50%, 10px)';
    setTimeout(() => {
      notification.remove();
    }, 500);
  }
}

// Function to sort courses by professor ratings
function sortCoursesByRating() {
  console.log('ScheduleMate: Sorting courses by professor rating...');
  
  // Check if RMP data is loaded
  if (!rmpData || !rmpData.professors) {
    console.log('ScheduleMate: No RMP data available for sorting');
    showNotification('Cannot sort by rating: No professor data available', 3000);
    return;
  }
  
  // Check if classes are already fully loaded
  const totalClassesOnPage = document.querySelectorAll('.course-container').length;
  let allClassesLoaded = false;
  
  // If we have a significant number of classes already loaded, assume they're all loaded
  if (totalClassesOnPage > 50) {
    allClassesLoaded = true;
    console.log(`ScheduleMate: Detected ${totalClassesOnPage} classes already loaded, skipping loading step`);
  }
  
  if (allClassesLoaded) {
    // Skip loading and directly process and sort courses
    console.log('ScheduleMate: Classes already loaded, proceeding with sorting by rating');
    showNotification('Sorting classes by professor rating...', 3000);
    processSortCoursesByRating();
  } else {
    // Show loading notification
    showNotification('Loading all courses...', 60000); // Long timeout in case loading takes time
    
    // First, try to force load all content by scrolling to the bottom
    forceLoadAllCourses()
      .then(() => {
        // Then process and sort all courses
        processSortCoursesByRating();
      })
      .catch(error => {
        console.error('ScheduleMate: Error loading all courses', error);
        // Try to sort anyway with what we have
        processSortCoursesByRating();
      });
  }
}

// Function to process and sort courses by professor rating
function processSortCoursesByRating() {
  // Process all courses to ensure they have RMP data
  const courseContainers = document.querySelectorAll('.course-container');
  
  if (courseContainers.length === 0) {
    console.log('ScheduleMate: No courses found to sort by rating');
    hideNotification();
    showNotification('No courses found to sort', 3000);
    return;
  }
  
  console.log(`ScheduleMate: Processing ${courseContainers.length} courses for sorting by rating`);
  
  // Find the parent container 
  const parentContainer = courseContainers[0].parentElement;
  if (!parentContainer) {
    console.log('ScheduleMate: Cannot find parent container');
    hideNotification();
    showNotification('Error: Cannot find course container', 3000);
    return;
  }
  
  // Create an array of the course elements to sort
  const coursesArray = Array.from(courseContainers);
  
  // Function to get professor rating from a course element
  const getProfessorRating = (course) => {
    // Find professor link in the course
    const professorLink = course.querySelector('.results-instructor a[href^="mailto:"]');
    if (!professorLink) return -1; // No professor link found
    
    // Check if we already have rating displayed
    const ratingElement = course.querySelector('.schedule-mate-rating-quality');
    if (ratingElement) {
      const rating = parseFloat(ratingElement.textContent);
      return isNaN(rating) ? -1 : rating;
    }
    
    // If no rating is displayed yet, try to find it
    const fullName = professorLink.textContent.trim();
    const email = professorLink.getAttribute('href').replace('mailto:', '').toLowerCase();
    const emailId = email.split('@')[0].toLowerCase();
    
    // Try to find professor legacy ID
    const legacyId = findProfessorLegacyId(fullName, emailId);
    if (legacyId) {
      // Try to find professor info
      const professorInfo = findProfessorInfo(legacyId);
      if (professorInfo && professorInfo.avgRating) {
        return parseFloat(professorInfo.avgRating);
      }
    }
    
    return -1; // No rating found
  };
  
  // Sort the courses by professor rating (highest first)
  coursesArray.sort((a, b) => {
    const ratingA = getProfessorRating(a);
    const ratingB = getProfessorRating(b);
    
    // First sort by whether rating exists (courses with ratings come first)
    if (ratingA >= 0 && ratingB < 0) return -1;
    if (ratingA < 0 && ratingB >= 0) return 1;
    
    // Then sort by rating value (higher ratings first)
    return ratingB - ratingA;
  });
  
  // Reorder the elements in the DOM without destroying and recreating them
  // This preserves event listeners and added elements like RMP ratings
  
  // Create a document fragment to minimize reflow
  const fragment = document.createDocumentFragment();
  
  // Append each course to the fragment in the sorted order
  coursesArray.forEach(course => {
    fragment.appendChild(course);
  });
  
  // Append all courses back to the parent container at once
  parentContainer.appendChild(fragment);
  
  // Collapse all course details to make the page more manageable
  collapseAllCourseDetails();
  
  // Scroll back to the top of the page
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
  
  console.log('ScheduleMate: Courses sorted by professor rating successfully');
  
  // Hide loading notification and show success
  hideNotification();
  showNotification('Courses sorted by professor rating (highest first)', 3000);
}