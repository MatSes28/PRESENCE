# User Guide: Student-Subject Association Management

## Overview

This guide provides comprehensive instructions for using the new student-subject association features in the CLIRDEC Presence System. These features allow administrators to manage which students are enrolled in which subjects, providing better organization and tracking of academic progress.

## Table of Contents

1. [Accessing the Subject Enrollment Page](#accessing-the-subject-enrollment-page)
2. [Viewing Enrolled Students](#viewing-enrolled-students)
3. [Enrolling Students in Subjects](#enrolling-students-in-subjects)
4. [Unenrolling Students from Subjects](#unenrolling-students-from-subjects)
5. [Using the Students Tab Buttons](#using-the-students-tab-buttons)
6. [Student Detail Page](#student-detail-page)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Accessing the Subject Enrollment Page

### For Administrators:

1. **Login**: Log in to the CLIRDEC Presence System with your admin credentials
2. **Navigation**:
   - Click on the sidebar menu
   - Under the "Admin" section, click on "Subject Enrollment"
3. **Page Layout**: The Subject Enrollment page consists of:
   - Subject selection dropdown
   - Semester and academic year selectors
   - Enrolled students table
   - Enroll students button (for adding new students)

### For Faculty:

- Faculty members can view enrollments for their assigned subjects but cannot make changes
- Access is limited to subjects they are teaching

## Viewing Enrolled Students

1. **Select a Subject**:

   - Click the "Select a subject" dropdown
   - Choose the subject you want to view enrollments for
   - The page will automatically display all students enrolled in that subject

2. **View Student Information**:

   - The table shows:
     - Student ID
     - Student Name
     - Year & Section
     - Enrollment Date
   - For admin users: Actions column with "Unenroll" button

3. **Filter Options**:
   - Use the search box to find specific students
   - Filter by semester and academic year using the dropdowns

## Enrolling Students in Subjects

### Bulk Enrollment Process:

1. **Select Subject**: Choose the subject you want to enroll students in
2. **Set Semester & Year**: Select the appropriate semester and academic year
3. **Click "Enroll Students"**: Click the blue button to open the enrollment form

4. **Search for Students**:

   - Use the search box to find students by name or ID
   - Only students not already enrolled in the subject will appear

5. **Select Students**:

   - Check the checkbox next to each student you want to enroll
   - Selected students will be highlighted
   - The counter shows how many students are selected

6. **Enroll Students**:
   - Click "Enroll Selected Students" button
   - Wait for the success confirmation
   - The enrolled students table will update automatically

### Important Notes:

- You can enroll multiple students at once
- Students already enrolled in the subject won't appear in the available list
- Enrollment is subject-specific and includes semester/year information

## Unenrolling Students from Subjects

1. **Find the Student**:

   - Select the subject from the dropdown
   - Locate the student in the enrolled students table

2. **Unenroll Student**:

   - Click the "Unenroll" button next to the student's name
   - Confirm the action in the confirmation dialog
   - Wait for the success confirmation

3. **Verification**:
   - The student should disappear from the enrolled table
   - The student will reappear in the available students list for future enrollments

### Important Notes:

- Unenrollment is permanent for the selected subject/semester/year
- Students can be re-enrolled if needed
- Unenrollment doesn't delete the student from the system

## Using the Students Tab Buttons

The Students tab now has fully functional buttons:

### Edit Button

- **Purpose**: Edit student information
- **How to Use**: Click "Edit" to open the edit form with pre-filled student data
- **Permissions**: Admin only

### View Button

- **Purpose**: View comprehensive student details
- **How to Use**: Click "View" to navigate to the student detail page
- **Permissions**: All users with access to students

### Contact Button

- **Purpose**: Send messages to student's parents
- **How to Use**:
  1. Click "Contact" button
  2. Enter your message in the prompt
  3. Click OK to send
- **Permissions**: Admin and faculty
- **Use Cases**:
  - Academic progress updates
  - Attendance concerns
  - Behavior notifications
  - General communication

### Delete Button

- **Purpose**: Remove student from the system
- **How to Use**: Click "Delete" and confirm in the dialog
- **Permissions**: Admin only
- **Warning**: This action is permanent

## Student Detail Page

The student detail page provides comprehensive information about each student:

### Accessing the Page:

1. Go to the Students tab
2. Click "View" on any student
3. Or navigate directly to `/students/:id`

### Sections Available:

#### 1. Profile Information

- Student photo/initial
- Name and student ID
- Status (Active/Inactive)
- RFID status

#### 2. Contact Information

- Student email
- Parent name and email
- RFID UID

#### 3. Academic Information

- Program (BSIT)
- Year level
- Section
- Department and college
- Account creation date

#### 4. Contact Parent Section

- Textarea for composing messages
- Send button for immediate delivery
- Real-time notification of message status

#### 5. Subject Enrollments

- List of all subjects student is enrolled in
- Subject codes and names
- Semester and academic year
- Enrollment dates
- Link to manage enrollments (admin only)

#### 6. Recent Attendance Records

- Date and time of attendance
- Entry and exit times
- Attendance status (Present, Late, Absent)
- Detection method (RFID, Sensor, Manual)

### Using the Contact Parent Feature:

1. **Compose Message**:

   - Type your message in the textarea
   - Be clear and professional
   - Include relevant details about the student's progress or concerns

2. **Send Message**:

   - Click "Send Message to Parent"
   - Wait for confirmation notification
   - The message is sent immediately to the parent's email

3. **Best Practices**:
   - Use professional language
   - Be specific about concerns or achievements
   - Include action items if needed
   - Keep messages concise but informative

## Best Practices

### For Administrators:

1. **Regular Updates**: Review and update enrollments at the start of each semester
2. **Data Accuracy**: Ensure student information is current before enrollment
3. **Bulk Operations**: Use bulk enrollment for efficiency with large classes
4. **Documentation**: Keep records of enrollment changes for auditing
5. **Communication**: Use the contact feature to notify parents of important academic updates

### For Faculty:

1. **Monitor Enrollments**: Regularly check your subject enrollments
2. **Attendance Tracking**: Use the system to monitor student attendance patterns
3. **Parent Communication**: Use the contact feature for academic concerns
4. **Student Support**: Review student detail pages for comprehensive understanding

### For All Users:

1. **Data Privacy**: Respect student privacy and confidentiality
2. **Professional Communication**: Use appropriate language in parent messages
3. **System Updates**: Report any issues or bugs to the system administrator
4. **Training**: Familiarize yourself with all features through this guide

## Troubleshooting

### Common Issues and Solutions:

**Issue**: Can't see the Subject Enrollment option

- **Solution**: Ensure you're logged in as an admin user

**Issue**: Students not appearing in available list

- **Solution**: They may already be enrolled. Check the enrolled students table

**Issue**: Error when enrolling students

- **Solution**:
  - Check network connection
  - Verify you've selected a subject
  - Ensure at least one student is selected
  - Refresh the page and try again

**Issue**: Contact button not working

- **Solution**:
  - Check if student has parent email assigned
  - Verify your user permissions
  - Try refreshing the page

**Issue**: Student detail page not loading

- **Solution**:
  - Check the student ID in the URL
  - Verify the student exists in the system
  - Try accessing from the Students tab

### Getting Help:

1. **System Logs**: Check for error messages or notifications
2. **Browser Console**: Open developer tools to see detailed errors
3. **Support**: Contact your system administrator with:
   - Screenshots of the issue
   - Steps to reproduce
   - Error messages received

## Examples

### Example 1: Enrolling Students for a New Semester

**Scenario**: Start of 2nd Semester 2023-2024, need to enroll students in CS101

**Steps**:

1. Navigate to Subject Enrollment page
2. Select "CS101 - Introduction to Programming" from subject dropdown
3. Select "2nd Semester" and "2023-2024" from dropdowns
4. Click "Enroll Students"
5. Search for "Year 1" students
6. Select all relevant students (checkboxes)
7. Click "Enroll Selected Students"
8. Verify enrollment in the table

### Example 2: Contacting Parents About Attendance

**Scenario**: Student has poor attendance, need to notify parents

**Steps**:

1. Go to Students tab
2. Find the student with attendance issues
3. Click "View" to see detailed attendance records
4. Click "Contact" button
5. Write message: "Dear Parent, [Student Name] has missed 5 classes this month. Please help ensure regular attendance. Regards, [Your Name]"
6. Send the message
7. Document the communication

### Example 3: Updating Student Enrollments

**Scenario**: Student dropped a subject, need to update records

**Steps**:

1. Go to Subject Enrollment page
2. Select the subject student is dropping
3. Find the student in enrolled table
4. Click "Unenroll" button
5. Confirm the action
6. Verify student is removed from subject
7. Optionally enroll student in new subject if applicable

## Technical Details

### API Endpoints Used:

- `GET /enrollments/subject/:subjectId/students` - Get enrolled students
- `POST /enrollments/bulk` - Bulk enroll students
- `DELETE /enrollments/:studentId/:subjectId` - Unenroll student
- `POST /students/:studentId/contact` - Contact parent

### Data Flow:

1. **Enrollment**: Client → API → Database → Response → UI Update
2. **Contact**: Client → API → Email Service → Database Log → Response
3. **View**: Client → API → Database → Response → Render

### Performance Considerations:

- Bulk operations are optimized for performance
- Pagination is used for large student lists
- Caching improves repeated access to same data
- Real-time updates provide immediate feedback

## Conclusion

The student-subject association features provide powerful tools for managing academic enrollments and improving communication with parents. By following this guide, administrators and faculty can efficiently manage student enrollments, monitor academic progress, and maintain effective communication with parents.

For additional help or advanced features, consult your system administrator or refer to the technical documentation.
