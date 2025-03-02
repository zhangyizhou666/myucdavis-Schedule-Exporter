# UC Davis Schedule Exporter

A Chrome extension that exports your UC Davis class schedule to standard iCalendar (.ics) format for easy import into Google Calendar, Apple Calendar, Outlook, and other calendar applications.

## Features

- **Easy One-Click Export**: Quickly export your schedule with a single click
- **Quarter Detection**: Automatically detects current quarter and sets appropriate dates
- **Instructor Information**: Includes instructor names and email addresses in events
- **Clean Interface**: Modern interface with UC Davis colors and styling
- **Flexible Options**: Choose to export all courses or only registered courses
- **Compatible**: Works with all major calendar applications

## Installation

### From Chrome Web Store
1. Visit the [UC Davis Schedule Exporter](https://chrome.google.com/webstore/detail/uc-davis-schedule-exporter/xxxxx) in the Chrome Web Store
2. Click "Add to Chrome"
3. Confirm the installation when prompted

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory
5. The extension should now appear in your Chrome toolbar

## Usage

1. Log in to your UC Davis Schedule Builder
2. Click the UC Davis Schedule Exporter icon in your Chrome toolbar
3. Choose whether to export all courses or only registered courses
4. Click "Export to Calendar"
5. Select where to save the .ics file
6. Import the .ics file into your preferred calendar application

## How It Works

The extension:
1. Extracts course information from your current Schedule Builder page
2. Identifies class times, locations, and instructor information
3. Creates recurring calendar events for each class session
4. Packages everything in standard iCalendar format
5. Generates a downloadable .ics file

## Importing to Calendar Applications

### Google Calendar
1. Open [Google Calendar](https://calendar.google.com/)
2. Click the "+" icon next to "Other calendars"
3. Select "Import"
4. Upload the .ics file
5. Choose which calendar to add the events to
6. Click "Import"

### Apple Calendar
1. Open Apple Calendar
2. Select File → Import
3. Choose the .ics file
4. Select which calendar to add the events to
5. Click "Import"

### Outlook
1. Open Outlook
2. Select File → Open & Export → Import/Export
3. Choose "Import an iCalendar (.ics) or vCalendar file (.vcs)"
4. Browse to and select the .ics file
5. Choose to add as a new calendar or import to an existing calendar

## Privacy

The UC Davis Schedule Exporter extension:
- Only accesses data on UC Davis websites
- Does not collect or transmit any personal information
- Works entirely within your browser
- Does not require any account creation or login

## Permissions

- **activeTab**: To access the current Schedule Builder page
- **downloads**: To save the .ics file to your computer
- **host permissions for ucdavis.edu**: To run on the Schedule Builder website

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This extension is not affiliated with, endorsed by, or in any way officially connected with UC Davis. All product and university names are the registered trademarks of their original owners.
```
