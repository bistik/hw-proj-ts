PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_course_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`item_type` text NOT NULL,
	`item_id` integer NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_course_items`("id", "course_id", "item_type", "item_id", "position", "created_at", "updated_at") SELECT "id", "course_id", "item_type", "item_id", "position", "created_at", "updated_at" FROM `course_items`;--> statement-breakpoint
DROP TABLE `course_items`;--> statement-breakpoint
ALTER TABLE `__new_course_items` RENAME TO `course_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `course_items_course_position_unique` ON `course_items` (`course_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `course_items_type_item_unique` ON `course_items` (`item_type`,`item_id`);--> statement-breakpoint
CREATE TABLE `__new_enrollments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`course_id` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`enrolled_at` integer NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_enrollments`("id", "user_id", "course_id", "status", "enrolled_at", "completed_at", "created_at", "updated_at") SELECT "id", "user_id", "course_id", "status", "enrolled_at", "completed_at", "created_at", "updated_at" FROM `enrollments`;--> statement-breakpoint
DROP TABLE `enrollments`;--> statement-breakpoint
ALTER TABLE `__new_enrollments` RENAME TO `enrollments`;--> statement-breakpoint
CREATE UNIQUE INDEX `enrollments_user_course_unique` ON `enrollments` (`user_id`,`course_id`);--> statement-breakpoint
CREATE INDEX `enrollments_courseId_idx` ON `enrollments` (`course_id`);