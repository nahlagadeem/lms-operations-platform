# LMS Operations Platform Database Blueprint

## Purpose
This system is an internal operations platform for managing a large training/LMS project. It is not a learner-facing LMS. It manages:

- package-based course catalogs
- course scheduling and delivery
- trainers and providers
- locations and cities
- participant nominations and attendance
- evaluations and quality reports
- operational status tracking
- internal reporting and exports

## Source Inputs Used
- Excel workbook with 5 package tabs of courses
- PDF with operational delivery requirements

## Data Design Principles
- Separate course catalog from actual course delivery
- Keep package, course, and course run as different entities
- Support operational workflow, not just static lists
- Make filtering and reporting first-class concerns
- Keep room for importing Excel data now and scaling later

## Core Entities

### 1. packages
Represents the commercial/training package groups from the workbook.

Fields:
- `id`
- `code`
- `name_ar`
- `name_en`
- `description`
- `expected_trainee_count`
- `original_total_amount`
- `discounted_total_amount`
- `is_active`
- `created_at`
- `updated_at`

Notes:
- Initial values come from package summary and tabs `1` to `5`.

### 2. course_categories
Represents the high-level category of a course.

Examples:
- leadership programs
- professional certifications
- self-development and business skills
- english programs
- conferences and workshops

Fields:
- `id`
- `code`
- `name_ar`
- `name_en`
- `description`

### 3. courses
Represents the master course/program definition.

Fields:
- `id`
- `package_id`
- `category_id`
- `course_code`
- `name_ar`
- `name_en`
- `description`
- `delivery_type`
- `unit_of_measure`
- `default_duration_days`
- `default_duration_hours`
- `language`
- `is_external`
- `requires_certificate`
- `requires_provider_registration`
- `active_status`
- `created_at`
- `updated_at`

Notes:
- This table is the master catalog.
- One course can be scheduled many times later.

### 4. course_pricing
Represents pricing and discount structure for each master course.

Fields:
- `id`
- `course_id`
- `original_unit_price_with_tax`
- `original_unit_price_without_tax`
- `discount_percentage`
- `discount_amount`
- `final_unit_price_without_tax`
- `currency_code`
- `effective_from`
- `effective_to`

Notes:
- Keep pricing separate so it can change over time.

### 5. providers
Represents training vendors, academic institutions, certification bodies, and event organizers.

Fields:
- `id`
- `provider_type`
- `name_ar`
- `name_en`
- `country`
- `city`
- `contact_person`
- `email`
- `phone`
- `website`
- `is_active`
- `notes`
- `created_at`
- `updated_at`

### 6. trainers
Represents instructors or facilitators.

Fields:
- `id`
- `provider_id`
- `full_name_ar`
- `full_name_en`
- `email`
- `phone`
- `nationality`
- `years_of_experience`
- `is_approved`
- `approval_date`
- `bio`
- `specialization`
- `created_at`
- `updated_at`

Notes:
- PDF says trainer experience should be at least 20 years and approved by the government entity.

### 7. trainer_credentials
Represents trainer certifications and approvals.

Fields:
- `id`
- `trainer_id`
- `credential_name`
- `issuing_body`
- `credential_type`
- `issue_date`
- `expiry_date`
- `document_url`
- `verification_status`

### 8. locations
Represents physical or virtual training locations.

Fields:
- `id`
- `location_type`
- `name_ar`
- `name_en`
- `country`
- `city`
- `branch`
- `venue_name`
- `room_name`
- `address`
- `map_url`
- `timezone`
- `capacity`
- `is_active`

Notes:
- Must support city and venue reporting.

### 9. course_runs
Represents a real scheduled offering of a course.

Fields:
- `id`
- `course_id`
- `provider_id`
- `location_id`
- `run_code`
- `status`
- `delivery_mode`
- `start_date`
- `end_date`
- `start_time`
- `end_time`
- `planned_seats`
- `confirmed_seats`
- `attendance_required`
- `certificate_required`
- `course_card_status`
- `approval_status`
- `reschedule_count`
- `owner_user_id`
- `notes`
- `created_at`
- `updated_at`

Status values:
- `draft`
- `planned`
- `approval_pending`
- `open_for_nomination`
- `confirmed`
- `ongoing`
- `completed`
- `canceled`
- `postponed`
- `closed`

Notes:
- This is one of the most important tables in the system.

### 10. course_run_trainers
Represents the trainers assigned to each course run.

Fields:
- `id`
- `course_run_id`
- `trainer_id`
- `role`
- `is_primary`

### 11. course_run_documents
Represents course cards, guides, presentations, schedules, certificates, and event files.

Fields:
- `id`
- `course_run_id`
- `document_type`
- `file_name`
- `file_url`
- `uploaded_by_user_id`
- `uploaded_at`
- `notes`

Examples of document type:
- course_card
- presentation
- learner_guide
- attendance_sheet
- certificate_template
- quality_report
- final_report
- photos_archive

### 12. participants
Represents people related to the training project.

Fields:
- `id`
- `participant_type`
- `national_id_or_iqama`
- `employee_number`
- `full_name_ar`
- `full_name_en`
- `email`
- `phone`
- `organization_name`
- `job_title`
- `department`
- `city`
- `is_active`
- `created_at`
- `updated_at`

Participant types:
- `student`
- `teacher`
- `owner`
- `coordinator`
- `observer`

Notes:
- This can later scale toward the large population without loading everything into the first MVP UI.

### 13. nominations
Represents candidate nomination and confirmation workflow.

Fields:
- `id`
- `course_run_id`
- `participant_id`
- `nomination_status`
- `nominated_by_user_id`
- `nominated_at`
- `confirmation_status`
- `confirmed_at`
- `decline_reason`
- `replacement_for_nomination_id`
- `notes`

Nomination status values:
- `nominated`
- `contacted`
- `confirmed`
- `declined`
- `replaced`
- `withdrawn`

Notes:
- This directly supports the PDF requirement for confirming attendees and replacing declined candidates.

### 14. attendance_records
Represents daily attendance and absence tracking.

Fields:
- `id`
- `course_run_id`
- `participant_id`
- `attendance_date`
- `check_in_time`
- `check_out_time`
- `attendance_status`
- `notes`
- `recorded_by_user_id`
- `recorded_at`

Attendance status values:
- `present`
- `absent`
- `late`
- `excused`
- `partial`

### 15. evaluations
Represents post-course evaluations.

Fields:
- `id`
- `course_run_id`
- `participant_id`
- `trainer_score`
- `venue_score`
- `content_score`
- `operations_score`
- `overall_score`
- `positive_notes`
- `improvement_notes`
- `submitted_at`

Notes:
- PDF requires evaluation of trainers, halls, content, and operations.

### 16. quality_reports
Represents structured quality reporting after each course run.

Fields:
- `id`
- `course_run_id`
- `report_status`
- `submitted_by_user_id`
- `submitted_at`
- `due_date`
- `summary`
- `satisfaction_rate`
- `issues_found`
- `actions_taken`

Report status values:
- `pending`
- `draft`
- `submitted`
- `approved`

Notes:
- PDF requires quality report delivery within 3 days of each course.

### 17. final_project_reports
Represents periodic or end-of-project consolidated reporting.

Fields:
- `id`
- `report_type`
- `period_start`
- `period_end`
- `generated_by_user_id`
- `generated_at`
- `summary`
- `file_url`

Report types:
- `package_summary`
- `monthly_operations`
- `leadership_track_summary`
- `final_project_report`

### 18. app_users
Represents internal system users.

Fields:
- `id`
- `full_name`
- `email`
- `role`
- `department`
- `is_active`
- `last_login_at`
- `created_at`
- `updated_at`

Roles:
- `super_admin`
- `project_manager`
- `operations_coordinator`
- `reporting_analyst`
- `viewer`

### 19. audit_logs
Represents change history across the platform.

Fields:
- `id`
- `actor_user_id`
- `entity_type`
- `entity_id`
- `action_type`
- `old_values_json`
- `new_values_json`
- `created_at`

## Key Relationships
- one package -> many courses
- one course category -> many courses
- one course -> many pricing records
- one course -> many course runs
- one provider -> many trainers
- one provider -> many course runs
- one location -> many course runs
- one course run -> many assigned trainers
- one course run -> many nominations
- one participant -> many nominations
- one course run -> many attendance records
- one course run -> many evaluations
- one course run -> many documents
- one course run -> one or many quality/final reporting records

## Enums To Use
- `delivery_type`: `training`, `certification`, `language`, `conference`, `workshop`
- `delivery_mode`: `in_person`, `online`, `hybrid`, `abroad`
- `location_type`: `internal_venue`, `external_venue`, `online`, `international`
- `provider_type`: `training_center`, `university`, `certification_body`, `conference_organizer`, `vendor`
- `active_status`: `active`, `inactive`, `archived`

## MVP Scope
For the first build, the essential modules should be:
- packages
- courses
- course runs
- providers
- trainers
- locations
- nominations
- attendance
- evaluations
- quality reports
- users

## Recommended Build Order
1. Create database schema
2. Import packages and course catalog from Excel
3. Build courses list and filters
4. Build course runs and scheduling
5. Build nominations and attendance
6. Build evaluations and reports
7. Add audit logs and exports

## Immediate Next Step
Turn this blueprint into:
- Prisma schema
- PostgreSQL tables
- starter seed data
