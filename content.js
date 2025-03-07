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
  
  // Add CSS styles for color coding
  addScheduleMateStyles();
  
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
  const style = document.createElement('style');
  style.textContent = `
    /* Base Colors */
    .schedule-mate-blue {
      background-color: ${BLUE} !important;
    }
    .schedule-mate-conflict {
      background-color: ${RED} !important;
    }
    .schedule-mate-full {
      background-color: ${YELLOW} !important;
    }
    .schedule-mate-available {
      background-color: ${GREEN} !important;
    }
    
    /* Add more specificity to override any site styles */
    div.course-container.schedule-mate-blue,
    div.course-container.schedule-mate-conflict,
    div.course-container.schedule-mate-full,
    div.course-container.schedule-mate-available {
      transition: background-color 0.3s ease;
      position: relative !important;
    }
    
    /* Especially important conflict indicators */
    div.course-container.schedule-mate-conflict,
    div.course-container.schedule-mate-conflict * {
      background-color: ${RED} !important;
    }
    
    /* Add border to conflict courses for extra visibility */
    div.course-container.schedule-mate-conflict {
      border: 2px solid darkred !important;
    }
    
    /* Early morning class indicator - new prominent style */
    .schedule-mate-early-morning-indicator {
      background-color: #FBE3A4 !important;
      color: #B45F04 !important;
      padding: 5px 8px !important;
      margin: 5px 0 !important;
      border-radius: 4px !important;
      border-left: 4px solid #B45F04 !important;
      font-weight: bold !important;
      font-size: 14px !important;
      display: flex !important;
      align-items: center !important;
      width: calc(100% - 20px) !important;
      box-sizing: border-box !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12) !important;
      position: relative !important;
      z-index: 10 !important;
    }
    
    /* Late night class indicator */
    .schedule-mate-late-night-indicator {
      background-color: #E1D9F2 !important;
      color: #4A235A !important;
      padding: 5px 8px !important;
      margin: 5px 0 !important;
      border-radius: 4px !important;
      border-left: 4px solid #4A235A !important;
      font-weight: bold !important;
      font-size: 14px !important;
      display: flex !important;
      align-items: center !important;
      width: calc(100% - 20px) !important;
      box-sizing: border-box !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12) !important;
      position: relative !important;
      z-index: 10 !important;
    }
    
    /* Status labels - positioned at the bottom left */
    .schedule-mate-status-label {
      position: absolute !important;
      bottom: 5px !important;
      left: 5px !important; /* Changed from right to left */
      padding: 2px 6px !important;
      border-radius: 3px !important;
      font-size: 10px !important;
      font-weight: bold !important;
      text-transform: uppercase !important;
      z-index: 5 !important;
      box-shadow: 0 1px 2px rgba(0,0,0,0.15) !important;
      color: #000 !important;
    }
    
    /* Specific styling for each status type */
    .schedule-mate-status-schedule {
      background-color: rgba(0, 40, 85, 0.9) !important;
      color: white !important;
    }
    
    .schedule-mate-status-conflict {
      background-color: rgba(180, 0, 0, 0.9) !important;
      color: #FFFFFF !important; /* Keep white color but make it bolder */
      font-weight: 900 !important; /* Extra bold */
      text-shadow: 0px 0px 2px #000000 !important; /* Add text shadow for contrast */
      letter-spacing: 0.5px !important; /* Increase letter spacing for readability */
    }
    
    .schedule-mate-status-full {
      background-color: rgba(180, 140, 0, 0.9) !important;
      color: white !important;
    }
    
    .schedule-mate-status-available {
      background-color: rgba(0, 140, 0, 0.9) !important;
      color: white !important;
    }
    
    /* RateMyProfessor rating styles */
    .schedule-mate-rating {
      display: inline-block !important;
      margin-left: 10px !important;
      font-weight: bold !important;
      padding: 2px 5px !important;
      border-radius: 4px !important;
      background-color: rgba(240, 240, 240, 0.8) !important;
      font-size: 12px !important;
      vertical-align: middle !important;
      white-space: nowrap !important;
    }
    
    .schedule-mate-rating-found {
      border-left: 2px solid #4CAF50 !important;
    }
    
    .schedule-mate-rating-not-found {
      border-left: 2px solid #FFA726 !important;
      font-style: italic !important;
    }
    
    .schedule-mate-rating-user-added {
      border-left: 2px solid #2196F3 !important;
      background-color: rgba(220, 237, 255, 0.8) !important;
    }
    
    .schedule-mate-rating-quality {
      color: #002855 !important;
      position: relative !important;
    }
    
    .schedule-mate-rating-quality::before {
      content: "★ " !important;
      color: #FFD700 !important;
    }
    
    .schedule-mate-rating-difficulty {
      color: #555 !important;
      position: relative !important;
    }
    
    .schedule-mate-rating-difficulty::before {
      content: "⚖ " !important;
      color: #777 !important;
    }
    
    .schedule-mate-rmp-link {
      margin-left: 5px !important;
      text-decoration: none !important;
      font-size: 14px !important;
      color: #1976D2 !important;
    }
    
    .schedule-mate-rmp-link:hover {
      text-decoration: underline !important;
    }
    
    .schedule-mate-google-link {
      margin-left: 5px !important;
      text-decoration: none !important;
      font-size: 14px !important;
      color: #DD4B39 !important;
    }
    
    .schedule-mate-google-link:hover {
      text-decoration: underline !important;
    }
    
    /* Add rating button */
    .schedule-mate-add-rating {
      margin-left: 5px !important;
      cursor: pointer !important;
      color: #1976D2 !important;
      font-size: 12px !important;
    }
    
    .schedule-mate-add-rating:hover {
      text-decoration: underline !important;
    }
    
    /* Rating modal */
    .schedule-mate-modal {
      display: none;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background-color: rgba(0, 0, 0, 0.6) !important;
      z-index: 2000 !important;
      align-items: center !important;
      justify-content: center !important;
    }
    
    .schedule-mate-modal-content {
      background-color: white !important;
      padding: 20px !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2) !important;
      max-width: 400px !important;
      width: 100% !important;
    }
    
    .schedule-mate-modal-title {
      font-size: 18px !important;
      font-weight: bold !important;
      margin-bottom: 15px !important;
      color: #002855 !important;
    }
    
    .schedule-mate-modal-field {
      margin-bottom: 15px !important;
    }
    
    .schedule-mate-modal-field label {
      display: block !important;
      margin-bottom: 5px !important;
      font-weight: bold !important;
    }
    
    .schedule-mate-modal-field input {
      width: 100% !important;
      padding: 8px !important;
      border: 1px solid #ccc !important;
      border-radius: 4px !important;
    }
    
    .schedule-mate-modal-buttons {
      display: flex !important;
      justify-content: flex-end !important;
      gap: 10px !important;
    }
    
    .schedule-mate-modal-button {
      padding: 8px 16px !important;
      border: none !important;
      border-radius: 4px !important;
      cursor: pointer !important;
      font-weight: bold !important;
    }
    
    .schedule-mate-modal-save {
      background-color: #002855 !important;
      color: white !important;
    }
    
    .schedule-mate-modal-cancel {
      background-color: #f0f0f0 !important;
      color: #555 !important;
    }
    
    /* Sort button styling */
    .schedule-mate-sort-button {
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      background-color: #002855 !important;
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
      background-color: #003977 !important;
      transform: translateY(-2px) !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
    }
    
    .schedule-mate-sort-button::before {
      content: "🔄" !important;
      margin-right: 6px !important;
      font-size: 16px !important;
    }
    
    /* RMP reload button styling */
    .schedule-mate-rmp-reload-button {
      position: fixed !important;
      bottom: 20px !important;
      right: 180px !important; /* Position to the left of sort button */
      background-color: #8E6F3E !important; /* Different color to distinguish from sort button */
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
      background-color: #B28F54 !important;
      transform: translateY(-2px) !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
    }
    
    .schedule-mate-rmp-reload-button::before {
      content: "📊" !important;
      margin-right: 6px !important;
      font-size: 16px !important;
    }
    
    /* Browse all professors button styling */
    .schedule-mate-browse-rmp-button {
      position: fixed !important;
      bottom: 20px !important;
      right: 350px !important; /* Position to the left of reload button */
      background-color: #4A235A !important; /* Purple color for distinction */
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
    
    .schedule-mate-browse-rmp-button:hover {
      background-color: #6C3483 !important;
      transform: translateY(-2px) !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
    }
    
    .schedule-mate-browse-rmp-button::before {
      content: "👨‍🏫" !important;
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
    
    // Try to load the data from data.js
    fetch(chrome.runtime.getURL('data.js'))
      .then(response => response.text())
      .then(data => {
        // Extract JSON data from the data.js file
        // Assuming data.js contains something like "var rmpDataSet = {...};"
        try {
          // Try to extract JSON between {} brackets assuming proper formatting
          const jsonMatch = data.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const jsonData = jsonMatch[0];
            rmpData = JSON.parse(jsonData);
            console.log('ScheduleMate: RMP data parsed successfully from data.js');
          } else {
            // Alternative approach: eval the script to get the data
            // This is a fallback and generally not recommended, but may be necessary
            // if the data.js file is not a simple JSON structure
            const scriptTag = document.createElement('script');
            scriptTag.textContent = data + '\nwindow.rmpDataFromDataJs = rmpDataSet;';
            document.head.appendChild(scriptTag);
            
            // After script execution, get the data from the global variable
            setTimeout(() => {
              if (window.rmpDataFromDataJs) {
                rmpData = window.rmpDataFromDataJs;
                console.log('ScheduleMate: RMP data loaded via script tag execution');
                // Clean up
                document.head.removeChild(scriptTag);
                delete window.rmpDataFromDataJs;
                // Update UI after data is loaded
                displayRMPData();
              } else {
                throw new Error('Could not extract RMP data from data.js');
              }
            }, 100);
          }
        } catch (parseError) {
          console.error('ScheduleMate: Error parsing RMP data from data.js:', parseError);
          useFallbackRMPData();
        }
        
        // Update UI after data is loaded (if JSON parsing worked)
        if (rmpData) {
          displayRMPData();
        }
      })
      .catch(error => {
        console.error('ScheduleMate: Error loading RateMyProfessor data:', error);
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
  
  // Load user-added ratings
  loadUserRatings();
  
  // Find all professor links in the course containers
  const professorLinks = document.querySelectorAll('.results-instructor a[href^="mailto:"]');
  
  professorLinks.forEach(link => {
    // Get professor name from link text
    const fullName = link.textContent.trim();
    // Try to extract last name (assuming format is "First Last" or "F. Last")
    const lastName = fullName.split(' ').pop();
    // Try to extract first initial
    const firstInitial = fullName.charAt(0);
    
    // Check if this professor already has RMP data displayed
    if (link.nextElementSibling && link.nextElementSibling.classList.contains('schedule-mate-rating')) {
      return; // Skip if already displayed
    }
    
    // Check if we have user-added data for this professor
    if (userRatings[fullName]) {
      displayUserAddedRating(link, fullName, userRatings[fullName]);
      return;
    }
    
    // Create Google search URL for all professors
    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(fullName + " UC Davis ratemyprofessors")}`;
    
    // Check if we have data for this professor in RMP dataset
    if (rmpData[lastName] && rmpData[lastName][firstInitial]) {
      const profData = rmpData[lastName][firstInitial];
      
      // Create rating element
      const ratingElement = document.createElement('span');
      ratingElement.className = 'schedule-mate-rating schedule-mate-rating-found';
      
      // Add quality and difficulty ratings
      const qualitySpan = document.createElement('span');
      qualitySpan.className = 'schedule-mate-rating-quality';
      qualitySpan.textContent = `${profData.quality}`;
      qualitySpan.title = 'Professor Quality Rating';
      
      const difficultySpan = document.createElement('span');
      difficultySpan.className = 'schedule-mate-rating-difficulty';
      difficultySpan.textContent = `${profData.diff}`;
      difficultySpan.title = 'Course Difficulty Rating';
      
      // Add Google search link
      const googleLink = document.createElement('a');
      googleLink.href = googleSearchUrl;
      googleLink.target = '_blank';
      googleLink.className = 'schedule-mate-google-link';
      googleLink.textContent = 'Google';
      googleLink.title = 'Search for this professor on Google';
      
      // Assemble rating element
      ratingElement.appendChild(qualitySpan);
      ratingElement.appendChild(document.createTextNode(' / '));
      ratingElement.appendChild(difficultySpan);
      ratingElement.appendChild(document.createTextNode(' | '));
      ratingElement.appendChild(googleLink);
      
      // Insert after professor link
      link.parentNode.insertBefore(ratingElement, link.nextSibling);
      
      console.log(`ScheduleMate: Added RMP data for ${fullName}`);
    } else {
      // No data found for this professor, add Google search link only
      const searchElement = document.createElement('span');
      searchElement.className = 'schedule-mate-rating schedule-mate-rating-not-found';
      
      // Create Google search link
      const googleLink = document.createElement('a');
      googleLink.href = googleSearchUrl;
      googleLink.target = '_blank';
      googleLink.className = 'schedule-mate-google-link';
      googleLink.textContent = 'Google';
      googleLink.title = 'Search for this professor on Google';
      
      /* Temporarily disabled Add Rating feature
      // Add button to add custom rating
      const addRatingBtn = document.createElement('span');
      addRatingBtn.className = 'schedule-mate-add-rating';
      addRatingBtn.textContent = 'Add Rating';
      addRatingBtn.title = 'Add your own rating for this professor';
      addRatingBtn.addEventListener('click', () => {
        showAddRatingModal(fullName);
      });
      */
      
      // Assemble search element
      searchElement.appendChild(googleLink);
      // Temporarily disabled Add Rating
      // searchElement.appendChild(document.createTextNode(' | '));
      // searchElement.appendChild(addRatingBtn);
      
      // Insert after professor link
      link.parentNode.insertBefore(searchElement, link.nextSibling);
      
      console.log(`ScheduleMate: Added Google search link for ${fullName}`);
    }
  });
  
  console.log('ScheduleMate: Finished displaying RMP data');
}

// Use fallback RMP data when fetch fails
function useFallbackRMPData() {
  console.log('ScheduleMate: Using fallback RMP data');
  try {
    // This is a simplified version with common professors
    rmpData = {
      "Simmons": {"G": {"url": "123456", "quality": "4.2", "diff": "3.1"}},
      "D'souza": {"R": {"url": "654321", "quality": "3.8", "diff": "2.9"}},
      "Stevens": {"K": {"url": "789012", "quality": "4.0", "diff": "3.0"}}
      // We would add more professor data here in a real implementation
    };
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
  
  const sortButton = document.createElement('button');
  sortButton.className = 'schedule-mate-sort-button';
  sortButton.textContent = 'Sort by Color';
  sortButton.addEventListener('click', sortCoursesByColor);
  
  document.body.appendChild(sortButton);
  console.log('ScheduleMate: Added sort button');
  
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
    
    // Show notification
    showNotification(isHidden ? 'Showing all classes' : 'Hiding early morning and late night classes', 3000);
    
    // Toggle visibility of early/late classes
    toggleEarlyLateClasses(!isHidden); // !isHidden because we're toggling to the new state
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
    // Find the parent course container
    const courseContainer = indicator.closest('.course-container');
    
    if (courseContainer) {
      if (hide) {
        courseContainer.style.display = 'none';
        // Also add a data attribute so we can track which courses are hidden
        courseContainer.dataset.scheduleMateSuppressed = 'true';
      } else {
        courseContainer.style.display = '';
        // Remove the data attribute when showing
        delete courseContainer.dataset.scheduleMateSuppressed;
      }
      return true; // Container was found and toggled
    } else {
      console.warn('ScheduleMate: Could not find course container for indicator', indicator);
      // As a fallback, try to find the parent with the most generic approach
      let parent = indicator.parentElement;
      while (parent && !parent.classList.contains('course-container') && parent !== document.body) {
        parent = parent.parentElement;
      }
      
      if (parent && parent !== document.body) {
        console.log('ScheduleMate: Found alternative container', parent);
        if (hide) {
          parent.style.display = 'none';
          parent.dataset.scheduleMateSuppressed = 'true';
        } else {
          parent.style.display = '';
          delete parent.dataset.scheduleMateSuppressed;
        }
        return true; // Container was found and toggled with fallback
      }
    }
    return false; // Container not found
  };
  
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
  
  // Clear the parent container and re-add courses in sorted order
  parentContainer.innerHTML = '';
  coursesArray.forEach(course => {
    parentContainer.appendChild(course);
  });
  
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
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #002855;
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    font-weight: bold;
    z-index: 1001;
    box-shadow: 0 3px 8px rgba(0,0,0,0.3);
    opacity: 0;
    transition: opacity 0.3s ease;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Show the notification
  setTimeout(() => {
    notification.style.opacity = '1';
    
    // Auto-hide after duration if specified
    if (duration) {
      setTimeout(() => {
        hideNotification();
      }, duration);
    }
  }, 100);
}

// Hide notification
function hideNotification() {
  const notification = document.getElementById('schedule-mate-notification');
  if (notification) {
    notification.style.opacity = '0';
    setTimeout(() => {
      notification.remove();
    }, 500);
  }
}

// Global object to store user-added ratings
let userRatings = {};

// Load user ratings from storage
function loadUserRatings() {
  try {
    chrome.storage.local.get('scheduleMateUserRatings', result => {
      if (result.scheduleMateUserRatings) {
        userRatings = result.scheduleMateUserRatings;
        console.log(`ScheduleMate: Loaded ${Object.keys(userRatings).length} user-added ratings`);
      } else {
        userRatings = {};
        console.log('ScheduleMate: No user-added ratings found');
      }
    });
  } catch (e) {
    console.error('ScheduleMate: Error loading user ratings', e);
    userRatings = {};
  }
}

// Save user ratings to storage
function saveUserRatings() {
  try {
    chrome.storage.local.set({ 'scheduleMateUserRatings': userRatings }, () => {
      console.log(`ScheduleMate: Saved ${Object.keys(userRatings).length} user-added ratings`);
    });
  } catch (e) {
    console.error('ScheduleMate: Error saving user ratings', e);
  }
}

// Display user-added rating
function displayUserAddedRating(link, professorName, ratingData) {
  // Create rating element
  const ratingElement = document.createElement('span');
  ratingElement.className = 'schedule-mate-rating schedule-mate-rating-user-added';
  
  // Add quality and difficulty ratings
  const qualitySpan = document.createElement('span');
  qualitySpan.className = 'schedule-mate-rating-quality';
  qualitySpan.textContent = `${ratingData.quality}`;
  qualitySpan.title = 'Your Rating: Professor Quality';
  
  const difficultySpan = document.createElement('span');
  difficultySpan.className = 'schedule-mate-rating-difficulty';
  difficultySpan.textContent = `${ratingData.difficulty}`;
  difficultySpan.title = 'Your Rating: Course Difficulty';
  
  // Add edit button
  const editButton = document.createElement('span');
  editButton.className = 'schedule-mate-add-rating';
  editButton.textContent = 'Edit';
  editButton.title = 'Edit your rating for this professor';
  editButton.addEventListener('click', () => {
    showAddRatingModal(professorName, ratingData);
  });
  
  // Assemble rating element
  ratingElement.appendChild(document.createTextNode('(Your Rating) '));
  ratingElement.appendChild(qualitySpan);
  ratingElement.appendChild(document.createTextNode(' / '));
  ratingElement.appendChild(difficultySpan);
  ratingElement.appendChild(document.createTextNode(' '));
  ratingElement.appendChild(editButton);
  
  // Insert after professor link
  link.parentNode.insertBefore(ratingElement, link.nextSibling);
  
  console.log(`ScheduleMate: Added user rating for ${professorName}`);
}

// Show modal to add/edit rating
function showAddRatingModal(professorName, existingRating = null) {
  // Create modal if it doesn't exist
  let modal = document.getElementById('scheduleMateRatingModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'scheduleMateRatingModal';
    modal.className = 'schedule-mate-modal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'schedule-mate-modal-content';
    
    const title = document.createElement('div');
    title.className = 'schedule-mate-modal-title';
    title.id = 'scheduleMateModalTitle';
    
    const qualityField = document.createElement('div');
    qualityField.className = 'schedule-mate-modal-field';
    const qualityLabel = document.createElement('label');
    qualityLabel.textContent = 'Quality Rating (0-5):';
    qualityLabel.htmlFor = 'scheduleMateQualityInput';
    const qualityInput = document.createElement('input');
    qualityInput.type = 'number';
    qualityInput.min = '0';
    qualityInput.max = '5';
    qualityInput.step = '0.1';
    qualityInput.id = 'scheduleMateQualityInput';
    qualityField.appendChild(qualityLabel);
    qualityField.appendChild(qualityInput);
    
    const difficultyField = document.createElement('div');
    difficultyField.className = 'schedule-mate-modal-field';
    const difficultyLabel = document.createElement('label');
    difficultyLabel.textContent = 'Difficulty Rating (0-5):';
    difficultyLabel.htmlFor = 'scheduleMateDifficultyInput';
    const difficultyInput = document.createElement('input');
    difficultyInput.type = 'number';
    difficultyInput.min = '0';
    difficultyInput.max = '5';
    difficultyInput.step = '0.1';
    difficultyInput.id = 'scheduleMateDifficultyInput';
    difficultyField.appendChild(difficultyLabel);
    difficultyField.appendChild(difficultyInput);
    
    const noteField = document.createElement('div');
    noteField.className = 'schedule-mate-modal-field';
    noteField.innerHTML = '<em>Note: Ratings are saved locally in your browser and will persist between sessions.</em>';
    
    const buttons = document.createElement('div');
    buttons.className = 'schedule-mate-modal-buttons';
    
    const saveButton = document.createElement('button');
    saveButton.className = 'schedule-mate-modal-button schedule-mate-modal-save';
    saveButton.textContent = 'Save';
    saveButton.id = 'scheduleMateSaveRating';
    
    const cancelButton = document.createElement('button');
    cancelButton.className = 'schedule-mate-modal-button schedule-mate-modal-cancel';
    cancelButton.textContent = 'Cancel';
    cancelButton.id = 'scheduleMateCancelRating';
    
    buttons.appendChild(cancelButton);
    buttons.appendChild(saveButton);
    
    modalContent.appendChild(title);
    modalContent.appendChild(qualityField);
    modalContent.appendChild(difficultyField);
    modalContent.appendChild(noteField);
    modalContent.appendChild(buttons);
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Setup event listeners
    saveButton.addEventListener('click', saveRating);
    cancelButton.addEventListener('click', hideModal);
    
    // Close when clicking outside
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        hideModal();
      }
    });
  }
  
  // Update modal content for current professor
  document.getElementById('scheduleMateModalTitle').textContent = 
    `${existingRating ? 'Edit' : 'Add'} Rating for ${professorName}`;
  
  // Set values if editing
  document.getElementById('scheduleMateQualityInput').value = 
    existingRating ? existingRating.quality : '4.0';
  document.getElementById('scheduleMateDifficultyInput').value = 
    existingRating ? existingRating.difficulty : '3.0';
  
  // Store current professor name in the modal
  modal.dataset.professorName = professorName;
  
  // Show the modal
  modal.style.display = 'flex';
  
  function saveRating() {
    const quality = parseFloat(document.getElementById('scheduleMateQualityInput').value);
    const difficulty = parseFloat(document.getElementById('scheduleMateDifficultyInput').value);
    
    // Validate inputs
    if (isNaN(quality) || quality < 0 || quality > 5 || 
        isNaN(difficulty) || difficulty < 0 || difficulty > 5) {
      alert('Please enter valid ratings between 0 and 5.');
      return;
    }
    
    // Format to 1 decimal place
    const formattedQuality = quality.toFixed(1);
    const formattedDifficulty = difficulty.toFixed(1);
    
    // Get professor name from modal
    const professorName = modal.dataset.professorName;
    
    // Save rating
    userRatings[professorName] = {
      quality: formattedQuality,
      difficulty: formattedDifficulty,
      timestamp: Date.now()
    };
    
    // Save to storage
    saveUserRatings();
    
    // Update display
    clearRMPDisplays();
    displayRMPData();
    
    // Hide modal
    hideModal();
    
    // Show confirmation
    showNotification(`Rating saved for ${professorName}!`, 3000);
  }
  
  function hideModal() {
    modal.style.display = 'none';
  }
}