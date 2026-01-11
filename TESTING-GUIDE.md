# Testing Guide for Student-Subject Association Features

## Overview

This guide provides comprehensive testing instructions for the newly implemented student-subject association functionality and the fixed Students tab buttons.

## Features Implemented

### 1. Student-Subject Association Management

- **Subject Enrollment Page**: `/subject-enrollment`
- **Functionality**:
  - View students enrolled in specific subjects
  - Bulk enroll multiple students in a subject
  - Unenroll individual students from subjects
  - Filter by semester and academic year
  - Search and select students for enrollment

### 2. Fixed Students Tab Buttons

- **Edit**: Already working (opens edit form)
- **View**: Now navigates to student detail page
- **Contact**: Now sends messages to parents
- **Delete**: Already working (deletes student)

### 3. Student Detail Page

- **Route**: `/students/:id`
- **Features**:
  - Comprehensive student profile information
  - Academic information display
  - Subject enrollments overview
  - Recent attendance records
  - Contact parent functionality

## Testing Instructions

### Prerequisites

1. Ensure the development server is running
2. Log in as an admin user (only admin can access enrollment features)
3. Have some test students and subjects in the database

### Test Cases

#### 1. Subject Enrollment Management

**Test Case 1.1**: Access Subject Enrollment Page

- **Steps**:
  1. Navigate to the sidebar
  2. Click on "Subject Enrollment" under admin section
  3. Verify the page loads without errors
- **Expected Result**: Subject Enrollment page should display with subject selection dropdown

**Test Case 1.2**: View Enrolled Students

- **Steps**:
  1. On Subject Enrollment page, select a subject from dropdown
  2. Observe the enrolled students table
  3. Verify student names, IDs, and enrollment dates are displayed
- **Expected Result**: Table should show all students enrolled in the selected subject

**Test Case 1.3**: Bulk Enroll Students

- **Steps**:
  1. Select a subject from dropdown
  2. Click "Enroll Students" button
  3. Search for students using the search box
  4. Select multiple students by checking checkboxes
  5. Click "Enroll Selected Students" button
  6. Confirm the success notification appears
- **Expected Result**:
  - Selected students should be added to the enrolled students table
  - Success notification should appear
  - Students should no longer appear in available students list

**Test Case 1.4**: Unenroll Student

- **Steps**:
  1. Select a subject with enrolled students
  2. Find a student in the enrolled table
  3. Click "Unenroll" button for that student
  4. Confirm the action in the confirmation dialog
  5. Verify the success notification appears
- **Expected Result**:
  - Student should be removed from enrolled students table
  - Success notification should appear
  - Student should reappear in available students list

**Test Case 1.5**: Filter by Semester/Academic Year

- **Steps**:
  1. Change semester dropdown to different semester
  2. Change academic year dropdown to different year
  3. Select a subject and attempt to enroll students
- **Expected Result**: Enrollment should be created with selected semester and year

#### 2. Students Tab Buttons

**Test Case 2.1**: Edit Button

- **Steps**:
  1. Go to Students page
  2. Click "Edit" button on any student
  3. Verify edit form opens with student data pre-filled
  4. Make changes and click "Update Student"
- **Expected Result**: Student data should be updated successfully

**Test Case 2.2**: View Button

- **Steps**:
  1. Go to Students page
  2. Click "View" button on any student
  3. Verify navigation to student detail page
  4. Check all student information is displayed correctly
- **Expected Result**: Should navigate to `/students/:id` and show comprehensive student details

**Test Case 2.3**: Contact Button

- **Steps**:
  1. Go to Students page
  2. Click "Contact" button on any student
  3. Enter a test message in the prompt
  4. Click OK to send
  5. Verify success notification appears
- **Expected Result**:
  - Message should be sent to parent
  - Success notification should appear
  - No errors should occur

**Test Case 2.4**: Delete Button

- **Steps**:
  1. Go to Students page
  2. Click "Delete" button on a test student
  3. Confirm deletion in dialog
  4. Verify success notification appears
- **Expected Result**: Student should be removed from the system

#### 3. Student Detail Page

**Test Case 3.1**: Access Student Detail Page

- **Steps**:
  1. Go to Students page
  2. Click "View" button on any student
  3. Verify page loads with student information
- **Expected Result**: Student detail page should display all student information

**Test Case 3.2**: View Subject Enrollments

- **Steps**:
  1. On student detail page, scroll to "Subject Enrollments" section
  2. Verify all subjects student is enrolled in are listed
  3. Check subject codes, names, semesters are correct
- **Expected Result**: All student enrollments should be displayed correctly

**Test Case 3.3**: View Attendance Records

- **Steps**:
  1. On student detail page, scroll to "Recent Attendance Records" section
  2. Verify attendance records are displayed
  3. Check dates, times, and statuses are correct
- **Expected Result**: Recent attendance records should be shown with proper formatting

**Test Case 3.4**: Contact Parent from Detail Page

- **Steps**:
  1. On student detail page, find "Contact Parent" section
  2. Enter a message in the textarea
  3. Click "Send Message to Parent" button
  4. Verify success notification appears
- **Expected Result**: Message should be sent successfully

### 4. Error Handling

**Test Case 4.1**: Invalid Subject Selection

- **Steps**:
  1. Go to Subject Enrollment page
  2. Don't select any subject
  3. Try to click "Enroll Students" button (if visible)
- **Expected Result**: Should show validation error or disable button

**Test Case 4.2**: Enroll Without Selecting Students

- **Steps**:
  1. Go to Subject Enrollment page
  2. Select a subject
  3. Click "Enroll Students" button
  4. Don't select any students
  5. Click "Enroll Selected Students" button
- **Expected Result**: Should show validation error and not allow enrollment

**Test Case 4.3**: Network Error Handling

- **Steps**:
  1. Disable network connection
  2. Try to perform any enrollment action
  3. Verify error notification appears
- **Expected Result**: Should show network error notification

## Regression Testing

Ensure that existing functionality still works:

1. **Student Management**: Adding, editing, deleting students
2. **Subject Management**: Adding, editing, deleting subjects
3. **Attendance Tracking**: RFID and sensor-based attendance
4. **Reporting**: Generate various reports
5. **User Management**: Admin functions for user management

## Performance Testing

1. **Large Student Lists**: Test with 100+ students in enrollment lists
2. **Bulk Operations**: Test enrolling 20+ students at once
3. **Page Load Times**: Verify pages load within acceptable time frames

## Browser Compatibility

Test on:

- Chrome (latest version)
- Firefox (latest version)
- Safari (latest version)
- Edge (latest version)
- Mobile browsers (iOS and Android)

## Accessibility Testing

1. **Keyboard Navigation**: Ensure all buttons and form fields are accessible via keyboard
2. **Screen Reader**: Test with screen reader software
3. **Color Contrast**: Verify sufficient contrast for readability
4. **Form Labels**: Ensure all form fields have proper labels

## Security Testing

1. **Role-Based Access**: Verify only admin can access enrollment features
2. **Data Validation**: Test input validation for all forms
3. **CSRF Protection**: Ensure proper CSRF tokens are used
4. **Authentication**: Verify all endpoints require authentication

## Documentation

After successful testing, refer to the [USER-GUIDE.md](#) for detailed usage instructions and examples.
