CREATE TABLE `follows` (
	`owner` text NOT NULL,
	`target` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `follow_pair` ON `follows` (`owner`,`target`);--> statement-breakpoint
CREATE TABLE `friendships` (
	`first` text NOT NULL,
	`second` text NOT NULL,
	`requester` text NOT NULL,
	`state` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`first`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`second`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requester`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friend_pair` ON `friendships` (`first`,`second`);--> statement-breakpoint
CREATE TABLE `notes` (
	`owner` text NOT NULL,
	`target` text NOT NULL,
	`label` text NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `note_pair` ON `notes` (`owner`,`target`);--> statement-breakpoint
ALTER TABLE `people` ADD `space_name` text DEFAULT '我的空间' NOT NULL;--> statement-breakpoint
ALTER TABLE `people` ADD `effect` text DEFAULT 'fireworks' NOT NULL;