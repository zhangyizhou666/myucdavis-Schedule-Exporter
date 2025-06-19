# ScheduleMate Browser Extension - Technical System Design Document

## Overview
ScheduleMate is a browser extension content script that enhances the UC Davis Schedule Builder interface with intelligent features including conflict detection, color coding, RateMyProfessor integration, and advanced sorting capabilities.

**Purpose**: This document serves as a comprehensive technical reference for feature engineers and AI agents who need to understand, modify, or rebuild the system architecture.

## Architecture Overview

### High-Level System Flow
```
Browser Extension Load → Content Script Injection → Initialization → Feature Loading → Dynamic UI Updates
```

### Critical Function Call Chain
```
initializeScheduleMate() → completeInitialization() → [loadRMPData(), loadSchedule(), updateUI(), addSortButton(), addDynamicContentObserver()]
```

## Core Components

### 1. Initialization System
**Main Controller**: `initializeScheduleMate()`

#### Function Signatures & Dependencies

```javascript
// Entry Point
initializeScheduleMate() -> void
├── Input: None (reads window.location.href)
├── Calls: addScheduleMateStyles()
├── Calls: chrome.storage.sync.get(object, callback)
├── Success Path: completeInitialization()
└── Failure Path: useDefaultPreferences()

// Core Initialization Chain
completeInitialization() -> void
├── Input: Uses global scheduleMatePreferences
├── Calls: loadRMPData() [if rmpIntegration enabled]
├── Calls: loadSchedule()
├── Calls: updateUI()
├── Calls: addSortButton()
└── Calls: addDynamicContentObserver()

// Fallback Handler
useDefaultPreferences() -> void
├── Input: None
├── Modifies: global scheduleMatePreferences object
└── Calls: completeInitialization()

// Style Injection
addScheduleMateStyles() -> void
├── Input: None
├── Creates: <style> element with id 'schedule-mate-styles'
└── Appends: CSS to document.head
```

**Critical Dependencies**: 
- Window location must contain 'my.ucdavis.edu/schedulebuilder'
- Chrome extension API availability
- DOM ready state

### 2. Data Management Layer

#### Global State Objects
```javascript
scheduleMatePreferences = {
  conflictDetection: boolean,
  colorCoding: boolean,
  rmpIntegration: boolean,
  earlyMorningWarning: boolean
}

rmpData = {
  professors: Object, // Legacy ID → Professor data mapping
  legacyIds: Object   // Name/Email → Legacy ID mapping
}

selectedSchedule = Course[] // Array of user's selected courses
finals = Final[]           // Array of final exam objects
```

#### Data Models

```javascript
// Course Constructor
Course(name: string, start: number, end: number, days: string) -> Course
├── Properties:
│   ├── name: string (course identifier)
│   ├── days: string (cleaned, comma-free day codes)
│   ├── start: number (24-hour format as integer, e.g., 900 for 9:00 AM)
│   ├── end: number (24-hour format as integer, e.g., 1050 for 10:50 AM)
│   └── meetings: Array<{days, start, end}>
└── Methods:
    └── conflicts(class2: Course) -> string|false
        ├── Input: Another Course object
        ├── Logic: Checks day overlap AND time overlap
        └── Returns: class2.name if conflict, false otherwise

// Final Constructor  
Final(date: string, time: string) -> Final
├── Properties:
│   ├── name: string (set separately)
│   ├── date: string (date string)
│   ├── startTime: number (converted from 12-hour to 24-hour format)
│   └── endTime: number (startTime + 200, assumes 2-hour duration)
└── Methods:
    └── conflicts(final2: Final) -> boolean
        ├── Input: Another Final object
        ├── Logic: Same date AND time overlap
        └── Returns: boolean indicating conflict

// Helper Function Used by Models
convertTime12to24(time12: string) -> {hours: number, minutes: number}
├── Input: Time string like "9:00 AM" or "10:50 PM"
├── Logic: Handles 12-hour to 24-hour conversion
└── Returns: Object with numeric hours and minutes

parseTimeRange(timeText: string) -> {start: string, end: string}
├── Input: Time range like "9:00 AM - 10:50 AM"
├── Calls: convertTime12to24() for both start and end times
└── Returns: Object with formatted 24-hour time strings
```

### 3. RateMyProfessor Integration System

#### Function Signatures & Data Flow

```javascript
// Main RMP Data Loader
loadRMPData() -> void
├── Input: None (uses chrome.runtime.getURL())
├── Calls: Promise.all([loadProfessorsPromise, loadLegacyIdsPromise])
├── Fetches: 'uc_davis_professors.json', 'uc_davis_legacyIds.json'
├── Processes: Arrays → Objects for faster lookup
├── Sets: global rmpData = {professors: Object, legacyIds: Object}
├── Success: displayRMPData()
└── Error: useFallbackRMPData()

// RMP Display Controller
displayRMPData() -> void
├── Input: Uses global rmpData
├── Queries: document.querySelectorAll('.results-instructor a[href^="mailto:"]')
├── For each professor link:
│   ├── Calls: findProfessorLegacyId(fullName, emailId)
│   ├── Calls: findProfessorInfo(legacyId) [if ID found]
│   ├── Calls: displayProfessorInfo() OR displayRMPLink() OR displaySearchLink()
│   └── Skips if rating already exists
└── Creates: DOM elements for each professor

// Professor Matching Engine (Complex Algorithm)
findProfessorLegacyId(fullName: string, emailId: string) -> string|null
├── Input: Professor full name + email ID
├── Priority Matching:
│   ├── 1. Email ID exact match: rmpData.legacyIds[emailId]
│   ├── 2. Full name exact match (case insensitive)
│   ├── 3. Abbreviated name processing:
│   │   ├── Parse: "S. Saltzen" → firstInitial="s", lastName="saltzen"
│   │   ├── Find: Last name matches in database
│   │   └── Filter: By first initial if available
│   ├── 4. Special cases: "Porquet-Lupine", "Sadoghi Hamedani"
│   └── 5. Flexible normalized matching
└── Returns: legacyId string or null

// Professor Data Retriever
findProfessorInfo(legacyId: string) -> Object|null
├── Input: Legacy ID string
├── Lookup: rmpData.professors[legacyId]
└── Returns: Professor object with {avgRating, avgDifficulty, wouldTakeAgainPercent} or null

// Display Functions (Create DOM elements)
displayProfessorInfo(link: Element, professorInfo: Object, legacyId: string) -> void
├── Input: Professor link element, rating data, legacy ID
├── Creates: Rating span with quality/difficulty/takeAgain percentages
├── Creates: RMP link to https://www.ratemyprofessors.com/professor/{legacyId}
└── Inserts: After professor link in DOM

displayRMPLink(link: Element, fullName: string, legacyId: string) -> void
├── Input: Professor link, name, legacy ID (no detailed rating data)
├── Creates: Simple RMP link span
└── Inserts: After professor link in DOM

displaySearchLink(link: Element, fullName: string) -> void
├── Input: Professor link, name (no data found)
├── Creates: Search link to RMP with UC Davis school ID (1073)
├── Query: encodeURIComponent(`${searchQuery} UC Davis`)
└── URL: https://www.ratemyprofessors.com/search/teachers?query={query}&sid=1073

// Fallback System
useFallbackRMPData() -> void
├── Input: None (error handling)
├── Creates: Minimal rmpData with example professor
├── Sets: Global rmpData with basic structure
└── Calls: updateUI()
```

#### Professor Matching Algorithm Priority
1. **Email ID Matching** (most reliable) - Direct lookup by UC Davis email prefix
2. **Exact Name Matching** - Case-insensitive full name comparison  
3. **Abbreviated Name Processing** - Handles "S. Saltzen" → matches "Sarah Saltzen"
4. **Flexible Last Name Matching** - For compound names like "Sadoghi Hamedani"
5. **Fallback Search Links** - Direct search on RMP when no data found

### 4. Conflict Detection Engine

#### Function Signatures & Conflict Algorithm

```javascript
// Schedule Data Loader
loadSchedule() -> void
├── Input: None (queries DOM)
├── Clears: global selectedSchedule = [], finals = []
├── Queries: document.querySelectorAll('.course-container')
├── Filters: Only courses with .btn-success (saved courses)
├── For each saved course:
│   ├── Extracts: title, final exam info, meeting times
│   ├── Calls: parseTimeRange(timeText) for time conversion
│   ├── Creates: Course objects and Final objects
│   └── Pushes: To selectedSchedule[] and finals[]
└── Logs: Number of courses loaded for conflict detection

// Individual Course UI Processor
updateCourseUI(course: Element) -> void
├── Input: DOM course container element
├── Guards: Skip if already processed (data-schedule-mate-processed)
├── Extracts: title, CRN, meeting times, seat availability
├── Conflict Detection Path:
│   ├── For each meeting in course:
│   │   ├── Calls: parseTimeRange(timeText)
│   │   ├── Converts: Time to numeric format (e.g., 900 for 9:00 AM)
│   │   ├── Loops: Through selectedSchedule[] 
│   │   └── Checks: Day overlap AND time overlap
│   └── Sets: hasConflict = true, conflictName if found
├── Color Classification:
│   ├── Blue: isSaved (already in schedule)
│   ├── Red: hasConflict OR existing conflict alert
│   ├── Yellow: isFull (available seats <= 0)
│   └── Green: available (default)
├── Calls: addStatusLabel(), checkForEarlyMorningClass()
└── Sets: data-schedule-mate-processed="true"

// Early Morning/Late Night Detector
checkForEarlyMorningClass(course: Element) -> void
├── Input: Course container element
├── Queries: meeting-item divs within course
├── For each meeting:
│   ├── Calls: convertTime12to24(startTime), convertTime12to24(endTime)
│   ├── Early morning check: startTime.hours <= 9
│   ├── Late night check: startTime.hours >= 18
│   └── Creates: Indicator elements with time display
└── Prepends: Indicators to course container

// Core Conflict Detection Logic (in Course.conflicts method)
Course.conflicts(class2: Course) -> string|false
├── Input: Another Course object to check against
├── Algorithm:
│   ├── For each day in this.days:
│   │   ├── Check: class2.days.includes(currentDay)
│   │   ├── Check: this.start <= class2.end && this.end >= class2.start
│   │   └── Return: class2.name if both conditions true
│   └── Return: false if no conflicts found
└── Returns: Conflicting course name or false

// Time Parsing Utilities
parseTimeRange(timeText: string) -> {start: string, end: string}
├── Input: "9:00 AM - 10:50 AM"
├── Splits: timeText.split(' - ')
├── Calls: convertTime12to24() for both parts
└── Returns: {start: "09:00", end: "10:50"}

convertTime12to24(time12: string) -> {hours: number, minutes: number}
├── Input: "9:00 AM" or "10:50 PM"
├── Regex: Extracts time and AM/PM modifier
├── Logic: Handles 12-hour to 24-hour conversion rules
└── Returns: Numeric hours and minutes
```

#### Conflict Detection Algorithm Detail
1. **Extract Saved Schedule**: Parse DOM for courses with `.btn-success`
2. **Parse Meeting Times**: Convert "9:00 AM - 10:50 AM" → numeric ranges
3. **Day Pattern Matching**: Check if course days overlap (M,T,W,R,F)
4. **Time Overlap Detection**: `startA <= endB && endA >= startB`
5. **UI Classification**: Apply color coding based on conflict status

### 5. UI Management System

#### Function Signatures & UI Management

```javascript
// Master UI Controller
updateUI() -> void
├── Input: Uses global scheduleMatePreferences
├── Guards: Skip if all features disabled
├── Queries: document.querySelectorAll('.course-container')
├── For each course:
│   ├── Calls: updateCourseUI(course)
│   └── Logs: Progress for debugging
├── Conditional RMP Display:
│   └── Calls: displayRMPData() [if rmpIntegration && rmpData]
└── Updates: All visible course containers

// Dynamic Content Watcher
addDynamicContentObserver() -> void
├── Input: None
├── Creates: MutationObserver with callback
├── Observer Logic:
│   ├── Watches: document.body for childList changes
│   ├── Filters: Only course-container additions
│   ├── For new courses: updateCourseUI(newCourse)
│   └── Triggers: displayRMPData() if RMP enabled
├── Error Handling: Disconnect after 3 errors
└── Cleanup: beforeunload and chrome.runtime.onSuspend listeners

// Status Label Manager
addStatusLabel(course: Element, text: string, type: string) -> void
├── Input: Course element, label text, status type
├── Removes: Existing .schedule-mate-status-label elements
├── Creates: New label with class schedule-mate-status-${type}
└── Appends: Label to course container

// Notification System
showNotification(message: string, duration?: number) -> void
├── Input: Message text, optional auto-hide duration
├── Removes: Existing notifications via hideNotification()
├── Creates: Fixed position notification div
├── Styles: High z-index (100000), UC Davis colors
├── Animation: Fade in with transform
└── Auto-hide: setTimeout(hideNotification, duration) if duration provided

hideNotification() -> void
├── Input: None
├── Finds: document.getElementById('schedule-mate-notification')
├── Animation: Fade out with transform
└── Cleanup: Remove element after 500ms

// Reset Processing State
resetProcessingState() -> void
├── Input: None
├── Queries: All course containers with data-schedule-mate-processed
├── Removes: data-schedule-mate-processed attribute from all
└── Purpose: Allow reprocessing of all courses
```

#### Color Coding System (CSS Classes Applied)
- **Green (schedule-mate-available)**: `hasConflict=false && isFull=false && !isSaved`
- **Yellow (schedule-mate-full)**: `hasConflict=false && isFull=true && !isSaved`  
- **Red (schedule-mate-conflict)**: `hasConflict=true || existingConflictAlert`
- **Blue (schedule-mate-blue)**: `isSaved=true` (course in user's schedule)

#### Dynamic Content Observer Pattern
```javascript
MutationObserver.observe(document.body, {
  childList: true,    // Watch for added/removed nodes
  subtree: true       // Watch entire DOM tree
}) → Filter for .course-container → updateCourseUI() → Apply all enhancements
```

### 6. Sorting System

#### Function Signatures & Sorting Logic

```javascript
// Color-Based Sorting Controller
sortCoursesByColor() -> void
├── Input: None
├── Check: totalClassesOnPage > 50 → allClassesLoaded = true
├── Path A (Classes Loaded):
│   ├── Calls: showNotification('Sorting classes by color...', 3000)
│   └── Calls: processSortCourses()
├── Path B (Need Loading):
│   ├── Calls: showNotification('Loading all courses...', 60000)
│   ├── Calls: forceLoadAllCourses()
│   └── Then: processSortCourses()
└── Error: processSortCourses() anyway

// Rating-Based Sorting Controller  
sortCoursesByRating() -> void
├── Input: None
├── Guards: Check rmpData availability
├── Check: totalClassesOnPage > 50 → allClassesLoaded = true
├── Path A (Classes Loaded):
│   ├── Calls: showNotification('Sorting classes by professor rating...', 3000)
│   └── Calls: processSortCoursesByRating()
├── Path B (Need Loading):
│   ├── Calls: showNotification('Loading all courses...', 60000)
│   ├── Calls: forceLoadAllCourses()
│   └── Then: processSortCoursesByRating()
└── Error: processSortCoursesByRating() anyway

// Course Loading System
forceLoadAllCourses() -> Promise<void>
├── Input: None
├── Calls: saveExpandedState() (preserve UI state)
├── Finds: Main container (#CourseList, .search-results, or body)
├── Scroll Algorithm:
│   ├── Initial count: document.querySelectorAll('.course-container').length
│   ├── Loop: Scroll to bottom, wait 1000ms, check new count
│   ├── Continue: While new courses load && attempts < 20
│   ├── During scroll: preventDetailExpansion()
│   └── Fallback: tryClickLoadMore() if no progress
├── Success: Resolve promise
└── Error: Resolve anyway (proceed with available courses)

// Color Sort Processor
processSortCourses() -> void
├── Input: Uses document.querySelectorAll('.course-container')
├── Reset: Remove data-schedule-mate-processed from all courses
├── Process: updateCourseUI(course) for each course
├── Color Priority Function:
│   ├── Available (Green) = 1 (highest priority)
│   ├── Full (Yellow) = 2
│   ├── Conflict (Red) = 3  
│   ├── In Schedule (Blue) = 4
│   └── No color = 5 (lowest priority)
├── Sort: coursesArray.sort((a,b) => priorityA - priorityB)
├── DOM Reorder: Document fragment → append sorted courses
├── Cleanup: collapseAllCourseDetails(), window.scrollTo(0,0)
└── Notify: hideNotification(), showNotification(success, 3000)

// Rating Sort Processor
processSortCoursesByRating() -> void
├── Input: Uses document.querySelectorAll('.course-container') 
├── Rating Extraction Function:
│   ├── Find: course.querySelector('.results-instructor a[href^="mailto:"]')
│   ├── Check: Existing .schedule-mate-rating-quality element
│   ├── Fallback: findProfessorLegacyId() → findProfessorInfo()
│   └── Return: parseFloat(avgRating) or -1 if not found
├── Sort Logic:
│   ├── Primary: Courses with ratings before courses without
│   └── Secondary: Higher ratings before lower ratings
├── DOM Reorder: Document fragment → append sorted courses  
├── Cleanup: collapseAllCourseDetails(), window.scrollTo(0,0)
└── Notify: hideNotification(), showNotification(success, 3000)

// UI State Management
saveExpandedState() -> void
├── Input: None
├── Queries: Course detail buttons/elements
├── Stores: window.scheduleMateExpandedState = [{element, expanded}]
└── Purpose: Preserve user's expanded course details

preventDetailExpansion() -> void
├── Input: None  
├── Finds: .course-more-info:not(.hide), .course-details-expanded
├── Adds: 'hide' class to expanded details
├── Resets: Detail button states (open → closed)
└── Purpose: Keep UI collapsed during loading

collapseAllCourseDetails() -> void
├── Input: None
├── Finds: All expanded course details and buttons
├── Applies: 'hide' class to details, 'closed' class to buttons
├── Text: Replace 'Hide Details' → 'Show Details'
└── Purpose: Clean UI after sorting
```

#### Sort Priority Orders
**Color Sort**: Available (1) → Full (2) → Conflict (3) → In Schedule (4) → No Color (5)
**Rating Sort**: Has Rating → No Rating, then by rating value (highest first)

### 7. Utility Layer

#### Function Signatures & Utilities

```javascript
// Course Code Formatting
formatCourseCode(courseCode: string) -> string
├── Input: Raw course code from HTML (e.g., "ECS 122A A01")
├── Processing: courseCode.trim().replace(/\s+/g, ' ')
├── Purpose: Ensure consistent spacing in course codes
└── Returns: Cleaned course code string

// Button Management System
addSortButton() -> void
├── Input: None (uses global scheduleMatePreferences)
├── Removes: Existing sort buttons (.schedule-mate-sort-button, .schedule-mate-sort-rating-button)
├── Color Sort Button (if colorCoding enabled):
│   ├── Creates: Button with class 'schedule-mate-sort-button'
│   ├── Position: Fixed bottom-right (right: 20px)
│   ├── Event: sortCoursesByColor() on click
│   └── Style: Green background, emoji prefix
├── Rating Sort Button (if rmpIntegration enabled):
│   ├── Creates: Button with class 'schedule-mate-sort-rating-button'  
│   ├── Position: Fixed bottom-right (right: 210px)
│   ├── Event: sortCoursesByRating() on click
│   └── Style: Purple background, star emoji prefix
└── Calls: addRMPReloadButton() if RMP enabled

// Early/Late Class Filter Button
addRMPReloadButton() -> void
├── Input: None
├── Removes: Existing filter buttons
├── Creates: Button with class 'schedule-mate-rmp-reload-button'
├── Position: Fixed bottom-right (right: 400px)
├── State Tracking: button.dataset.hidden = 'false'|'true'
├── Click Handler:
│   ├── Toggle: isHidden state
│   ├── Update: Button text ('Hide'/'Show Early/Late Classes')
│   ├── Check: allClassesLoaded = totalClassesOnPage > 50
│   ├── Path A: showNotification() → toggleEarlyLateClasses()
│   └── Path B: showNotification() → forceLoadAllCourses() → toggleEarlyLateClasses()
└── Style: Info color (teal), moon emoji prefix

// Early/Late Class Visibility Toggle
toggleEarlyLateClasses(hide: boolean) -> void
├── Input: Boolean to hide (true) or show (false)
├── Finds: All early/late indicators
├── Toggle Function:
│   ├── Strategy: Find course container via closest() or DOM walking
│   ├── Hide: Set display='none', dataset.scheduleMateSuppressed='true'
│   ├── Show: Remove display style, delete suppressed attribute
│   └── Fallback: Try multiple container finding approaches
├── Show Path: Find all [data-schedule-mate-suppressed="true"] and restore
├── Hide Path: Process each indicator individually
└── Logs: Number of early/late classes affected

// Utility Functions
clearRMPDisplays() -> void
├── Input: None
├── Queries: document.querySelectorAll('.schedule-mate-rating')
├── Removes: All RMP rating display elements
└── Purpose: Clean slate before re-displaying RMP data
```

#### Button Layout System (Fixed Positioning)
```
┌─────────────────────────────────────────────────────────────┐
│                                                        Page │
│                                                             │
│                                                             │
│                                                             │
└─[Hide Early/Late]──[Sort by Rating]──[Sort by Color]───────┘
  right: 400px       right: 210px      right: 20px
```

#### DOM Element Creation Pattern
All utility functions follow this pattern:
1. **Remove existing elements** (prevent duplicates)
2. **Create new element** with appropriate classes  
3. **Set properties** (text, styles, event listeners)
4. **Append to DOM** (usually document.body for floating elements)

### 8. Calendar Export System

#### Function Signatures & Export Logic

```javascript
// Quarter Date Calculator
getQuarterDates() -> {startDate: string, endDate: string, untilDate: string}
├── Input: None (reads DOM for term selector)
├── Queries: document.getElementById('TermSelectorText2')
├── Term Detection:
│   ├── Spring 2025: startDate='20250331', endDate='20250605'
│   ├── Winter 2025: startDate='20250106', endDate='20250314'  
│   ├── Fall 2024: startDate='20240925', endDate='20241206'
│   ├── Fall 2025: startDate='20250924', endDate='20251205'
│   └── Default: Spring 2025 dates
├── Format: YYYYMMDD for dates, YYYYMMDDTHHMMSSZ for until
└── Returns: Object with formatted date strings

// Main Event Extraction Engine
extractEventsFromPage(options: {registeredOnly?: boolean, debug?: boolean}) -> Array<Event>
├── Input: Options object (defaults: registeredOnly=true)
├── Calls: getQuarterDates() for term information
├── Course Discovery:
│   ├── Queries: document.querySelectorAll('div[id^="t"][class*="CourseItem"]')
│   ├── Filters: Exclude courses in SaveForLaterCourses container
│   ├── Registration filter: Only .statusIndicator.registered if registeredOnly=true
│   └── Extracts: Course title, instructor info, meeting times
├── Event Processing:
│   ├── Parse: Meeting times → time ranges
│   ├── Extract: Days (MTWRF), location, meeting type
│   ├── Format: Course code via formatCourseCode()
│   └── Create: Event objects with recurring schedule
├── Event Object Structure:
│   ├── type: 'recurring'
│   ├── summary: `${formattedCode} ${meetingType}`
│   ├── description: Course name + instructor + location
│   ├── location: Meeting location
│   ├── startTime/endTime: 24-hour format
│   ├── days: Array of day letters
│   ├── quarterStart: Academic quarter start date
│   └── until: Academic quarter end date
└── Returns: Array of calendar event objects

// Chrome Message Handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) -> void
├── Input: Message object from popup/background script
├── Action Handlers:
│   ├── 'extractEvents':
│   │   ├── Calls: extractEventsFromPage(request.options)
│   │   ├── Success: sendResponse({events: eventsArray})
│   │   └── Error: sendResponse({error: errorMessage})
│   └── 'applyPreferences':
│       ├── Updates: global scheduleMatePreferences
│       ├── Calls: updateUI(), addSortButton()
│       └── Success: sendResponse({success: true})
└── Returns: true (async response)
```

#### Calendar Event Data Structure
```javascript
EventObject = {
  type: 'recurring',
  summary: 'ECS 122A A01 Lecture',           // Course + section + type
  description: 'Algorithm Design & Analysis\nInstructor: John Smith (jsmith@ucdavis.edu)\nLocation: 123 Classroom',
  location: '123 Classroom',
  startTime: '09:00',                         // 24-hour format
  endTime: '10:50',                          // 24-hour format  
  days: ['M', 'W', 'F'],                     // Meeting days
  quarterStart: '20250331',                  // YYYYMMDD format
  until: '20250605T235959Z'                  // ISO datetime
}
```

#### Export Pipeline Flow
```
Message Received → extractEventsFromPage() → getQuarterDates() → Parse DOM → Format Events → Send Response
```

## Event-Driven Architecture

### Initialization Events
1. `DOMContentLoaded` → Initial setup
2. `window.load` → Secondary initialization with delay
3. `MutationObserver` → Continuous monitoring

### User Interaction Events
1. Sort buttons → Sorting functions
2. Hide/Show buttons → Filter functions
3. Chrome message passing → Preference updates

### Message Handling
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch(request.action) {
    case 'extractEvents': // Calendar export
    case 'applyPreferences': // Settings update
  }
});
```

## Data Flow Diagrams

### Main Initialization Flow
```
Page Load → Check URL → Load Preferences → Load RMP Data → Load Schedule → Update UI → Add Observers
```

### Conflict Detection Flow
```
Course Addition → Parse Meeting Times → Check Against Saved Schedule → Detect Conflicts → Apply Color Coding
```

### RMP Integration Flow
```
Find Professor Links → Extract Names/Emails → Match Against Database → Display Ratings/Links
```

## Error Handling Strategy

### Graceful Degradation
- Chrome API failures → Use default preferences
- RMP data loading failures → Use fallback data or disable feature
- DOM parsing errors → Continue with available data

### Fallback Mechanisms
- `useFallbackRMPData()` - Minimal dataset when loading fails
- `useDefaultPreferences()` - Default settings when storage unavailable
- Try-catch blocks around Chrome API calls

## Performance Optimizations

### Lazy Loading
- RMP data only loaded when integration enabled
- Dynamic processing as new courses appear

### DOM Efficiency
- Document fragments for bulk DOM operations
- Mutation observer with debouncing
- Minimal DOM queries with caching

### Memory Management
- Observer cleanup on page unload
- Preventing memory leaks in long-running observers

## Security Considerations

### Data Handling
- All RMP data loaded from extension package (no external APIs)
- Sanitized professor name matching
- Safe DOM manipulation practices

### Cross-Site Safety
- Content script isolation
- No eval() or dangerous DOM operations
- Proper CSP compliance

## Extension Points

### Adding New Features
1. **New Color Categories**: Extend color coding system
2. **Additional Data Sources**: Follow RMP integration pattern
3. **New Sorting Methods**: Add to sorting system
4. **Enhanced Notifications**: Extend notification system

### Configuration
- All features controlled by `scheduleMatePreferences`
- Easy enable/disable through Chrome storage
- Modular feature loading

## Dependencies

### External Dependencies
- Chrome Extension APIs (storage, runtime, messaging)
- UC Davis Schedule Builder DOM structure
- RateMyProfessor data files (JSON)

### Internal Dependencies
- Course/Final classes for conflict detection
- CSS classes for visual enhancements
- Event listeners for dynamic updates

## Function Dependency Map

### Critical Call Chains for Feature Engineers

```javascript
// Main Initialization Chain
initializeScheduleMate()
├── addScheduleMateStyles()
├── chrome.storage.sync.get() 
└── completeInitialization()
    ├── loadRMPData() [conditional]
    │   ├── Promise.all([fetch(), fetch()])
    │   ├── displayRMPData()
    │   │   ├── findProfessorLegacyId()
    │   │   ├── findProfessorInfo()
    │   │   └── displayProfessorInfo()|displayRMPLink()|displaySearchLink()
    │   └── useFallbackRMPData() [error case]
    ├── loadSchedule()
    │   ├── parseTimeRange()
    │   ├── convertTime12to24()
    │   └── new Course() creation
    ├── updateUI()
    │   ├── updateCourseUI() [for each course]
    │   │   ├── checkForEarlyMorningClass()
    │   │   │   └── convertTime12to24()
    │   │   ├── Course.conflicts() [conflict detection]
    │   │   └── addStatusLabel()
    │   └── displayRMPData() [conditional]
    ├── addSortButton()
    │   ├── sortCoursesByColor() [button event]
    │   │   ├── forceLoadAllCourses()
    │   │   └── processSortCourses()
    │   ├── sortCoursesByRating() [button event]
    │   │   ├── forceLoadAllCourses()
    │   │   └── processSortCoursesByRating()
    │   └── addRMPReloadButton()
    │       └── toggleEarlyLateClasses() [button event]
    └── addDynamicContentObserver()
        └── updateCourseUI() [for new courses]

// Message Handling Chain  
chrome.runtime.onMessage.addListener()
├── extractEvents → extractEventsFromPage()
│   ├── getQuarterDates()
│   ├── formatCourseCode()
│   └── parseTimeRange()
└── applyPreferences → updateUI() + addSortButton()
```

### Key Integration Points for New Features

1. **Adding New Color Categories**: Modify `updateCourseUI()` classification logic
2. **New Data Sources**: Follow `loadRMPData()` pattern with Promise.all()
3. **Additional Sorting**: Add button in `addSortButton()`, implement processor function
4. **Enhanced Notifications**: Extend `showNotification()`/`hideNotification()` system
5. **New Time-based Features**: Leverage `convertTime12to24()` and `parseTimeRange()`

### Performance-Critical Functions
- `updateCourseUI()`: Called for every course, must be efficient
- `displayRMPData()`: Processes all professor links, heavy DOM operations  
- `forceLoadAllCourses()`: Can trigger hundreds of DOM updates
- `MutationObserver callback`: Fires on every DOM change, needs filtering

### Error-Prone Integration Points
- **Chrome API calls**: Always wrap in try-catch, provide fallbacks
- **DOM element queries**: Elements may not exist, use optional chaining
- **Time parsing**: Handle various formats, validate inputs
- **Professor name matching**: Complex algorithm, may need adjustment for edge cases

This enhanced system design provides concrete implementation details for feature engineers and AI agents to understand, modify, or rebuild the ScheduleMate architecture effectively. 