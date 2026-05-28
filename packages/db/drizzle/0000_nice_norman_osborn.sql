CREATE TABLE `bendpoints` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`connection_id` integer NOT NULL,
	`x` integer NOT NULL,
	`y` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bendpoints_connection_idx` ON `bendpoints` (`connection_id`);--> statement-breakpoint
CREATE TABLE `connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`view_id` integer NOT NULL,
	`uuid` text NOT NULL,
	`name` text,
	`relationship_uuid` text,
	`source_node_uuid` text,
	`target_node_uuid` text,
	`line_color_r` integer,
	`line_color_g` integer,
	`line_color_b` integer,
	`line_color_a` integer,
	`line_width` integer,
	`font_name` text,
	`font_size` real,
	`font_color_r` integer,
	`font_color_g` integer,
	`font_color_b` integer,
	`font_color_a` integer,
	FOREIGN KEY (`view_id`) REFERENCES `views`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connections_uuid_view_uniq` ON `connections` (`view_id`,`uuid`);--> statement-breakpoint
CREATE INDEX `connections_view_idx` ON `connections` (`view_id`);--> statement-breakpoint
CREATE INDEX `connections_rel_idx` ON `connections` (`relationship_uuid`);--> statement-breakpoint
CREATE TABLE `element_properties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`element_id` integer NOT NULL,
	`property_def_uuid` text NOT NULL,
	`value` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`element_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `elem_props_element_idx` ON `element_properties` (`element_id`);--> statement-breakpoint
CREATE INDEX `elem_props_def_idx` ON `element_properties` (`property_def_uuid`);--> statement-breakpoint
CREATE TABLE `elements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`uuid` text NOT NULL,
	`type` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`description` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `elements_uuid_ws_uniq` ON `elements` (`workspace_id`,`uuid`);--> statement-breakpoint
CREATE INDEX `elements_workspace_idx` ON `elements` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `elements_type_idx` ON `elements` (`workspace_id`,`type`);--> statement-breakpoint
CREATE TABLE `nodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`view_id` integer NOT NULL,
	`uuid` text NOT NULL,
	`name` text,
	`element_uuid` text,
	`parent_node_uuid` text,
	`x` integer,
	`y` integer,
	`w` integer,
	`h` integer,
	`fill_color_r` integer,
	`fill_color_g` integer,
	`fill_color_b` integer,
	`fill_color_a` integer,
	`line_color_r` integer,
	`line_color_g` integer,
	`line_color_b` integer,
	`line_color_a` integer,
	`line_width` integer,
	`font_name` text,
	`font_size` real,
	`font_color_r` integer,
	`font_color_g` integer,
	`font_color_b` integer,
	`font_color_a` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`view_id`) REFERENCES `views`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nodes_uuid_view_uniq` ON `nodes` (`view_id`,`uuid`);--> statement-breakpoint
CREATE INDEX `nodes_view_idx` ON `nodes` (`view_id`);--> statement-breakpoint
CREATE INDEX `nodes_parent_idx` ON `nodes` (`view_id`,`parent_node_uuid`);--> statement-breakpoint
CREATE INDEX `nodes_element_idx` ON `nodes` (`element_uuid`);--> statement-breakpoint
CREATE TABLE `property_definitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`uuid` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'string' NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prop_defs_uuid_ws_uniq` ON `property_definitions` (`workspace_id`,`uuid`);--> statement-breakpoint
CREATE INDEX `prop_defs_workspace_idx` ON `property_definitions` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `relationship_properties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`relationship_id` integer NOT NULL,
	`property_def_uuid` text NOT NULL,
	`value` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`relationship_id`) REFERENCES `relationships`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rel_props_relationship_idx` ON `relationship_properties` (`relationship_id`);--> statement-breakpoint
CREATE INDEX `rel_props_def_idx` ON `relationship_properties` (`property_def_uuid`);--> statement-breakpoint
CREATE TABLE `relationships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`uuid` text NOT NULL,
	`type` text NOT NULL,
	`name` text,
	`description` text,
	`source_uuid` text NOT NULL,
	`target_uuid` text NOT NULL,
	`access_type` text,
	`is_directed` integer,
	`influence_modifier` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `relationships_uuid_ws_uniq` ON `relationships` (`workspace_id`,`uuid`);--> statement-breakpoint
CREATE INDEX `relationships_workspace_idx` ON `relationships` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `relationships_source_idx` ON `relationships` (`workspace_id`,`source_uuid`);--> statement-breakpoint
CREATE INDEX `relationships_target_idx` ON `relationships` (`workspace_id`,`target_uuid`);--> statement-breakpoint
CREATE TABLE `views` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`uuid` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`description` text,
	`viewpoint` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `views_uuid_ws_uniq` ON `views` (`workspace_id`,`uuid`);--> statement-breakpoint
CREATE INDEX `views_workspace_idx` ON `views` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`version` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_name_uniq` ON `workspaces` (`name`);