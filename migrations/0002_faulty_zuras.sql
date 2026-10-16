CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`person` text NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`salt` text NOT NULL,
	`recovery` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`person`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_person_unique` ON `accounts` (`person`);--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_username_unique` ON `accounts` (`username`);--> statement-breakpoint
CREATE TABLE `auth_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`until` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`account` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`account`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
