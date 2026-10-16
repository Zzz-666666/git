CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post` text NOT NULL,
	`author` text NOT NULL,
	`text` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`post`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hugs` (
	`post` text NOT NULL,
	`author` text NOT NULL,
	FOREIGN KEY (`post`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_hug` ON `hugs` (`post`,`author`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sender` text NOT NULL,
	`recipient` text NOT NULL,
	`text` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`sender`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`auth` text NOT NULL,
	`name` text NOT NULL,
	`bio` text NOT NULL,
	`avatar` text NOT NULL,
	`dm` integer DEFAULT 1 NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_auth_unique` ON `people` (`auth`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`author` text NOT NULL,
	`text` text NOT NULL,
	`mood` text NOT NULL,
	`visibility` text NOT NULL,
	`audio` text,
	`mime` text,
	`duration` integer,
	`created` integer NOT NULL,
	FOREIGN KEY (`author`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
