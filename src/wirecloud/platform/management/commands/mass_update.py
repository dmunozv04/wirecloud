# -*- coding: utf-8 -*-

# Copyright (c) 2024 Future Internet Consulting and Development Solutions S.L.

# This file is part of Wirecloud.

# Wirecloud is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

# Wirecloud is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.

# You should have received a copy of the GNU Affero General Public License
# along with Wirecloud.  If not, see <http://www.gnu.org/licenses/>.

from copy import deepcopy

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.core.management.base import CommandError

from wirecloud.platform.iwidget.models import IWidget
from wirecloud.platform.iwidget.utils import update_widget_value
from wirecloud.platform.wiring.views import WiringEntry
from wirecloud.platform.workspace.models import Workspace


class Command(BaseCommand):
    args = '<widget name> <new version> <user> --type <widget|operator>'
    help = 'Converts a widget description from one format to another'

    def add_arguments(self, parser):
        parser.add_argument(
            action='store',
            dest='widget',
            help=''
        )
        parser.add_argument(
            action='store',
            dest='new_version',
            help=''
        )
        parser.add_argument(
            action='store',
            dest='user',
            help=''
        )
        parser.add_argument(
            "--type",
            action='store',
            dest='type',
            help=''
        )

    def handle(self, *args, **options):
        if not options['widget'] or not options['new_version'] or not options['user'] or not options['type']:
            raise CommandError(
                'Missing parameters. You need to specify the widget, the new version, the user and the type of the resource.')
        if options['type'] not in ['widget', 'operator']:
            raise CommandError('Type must be either widget or operator')
        widget_details = options['widget'].split('/')
        # Get the django user
        user = User.objects.get(username=options['user'])
        # print(widget_details)
        new_version_data = {
            "widget": f"{widget_details[0]}/{widget_details[1]}/{options['new_version']}"}
        if options['type'] == 'widget':
            if len(widget_details) == 3:
                widgets_to_update = IWidget.objects.filter(
                    widget__resource__vendor=widget_details[0],
                    widget__resource__short_name=widget_details[1],
                    widget__resource__version=widget_details[2])
            elif len(widget_details) == 2:
                widgets_to_update = IWidget.objects.filter(
                    widget__resource__vendor=widget_details[0],
                    widget__resource__short_name=widget_details[1])
            else:
                raise CommandError(
                    'Wrong widget format. It should be vendor/name or vendor/name/version')
            # Exclude widgets that are already updated
            widgets_to_update = widgets_to_update.exclude(
                widget__resource__version=options['new_version'])
            # If no widgets to update
            if widgets_to_update.count() == 0:
                print(
                    f"No widgets to update for {options['widget']} to {options['new_version']} for user {options['user']}")
                return
            # Ask for confirmation
            print(
                f"Updating {widgets_to_update.count()} instances of {options['widget']} to {options['new_version']} for user {options['user']}")
            answer = input("Are you sure you want to update them? (yes/no): ")
            if answer != 'yes':
                print("Aborted")
                return
            for widget in widgets_to_update:
                update_widget_value(widget, new_version_data, user)
                widget.save()
            print(f"Updated {widgets_to_update.count()} widgets")
        elif options['type'] == 'operator':
            # Make sure they want to do this
            count = 0
            workspaces = Workspace.objects.filter(creator=user)
            for workspace in workspaces:
                old_wiring = workspace.wiringStatus
                new_wiring = deepcopy(old_wiring)
                # replace the name in operators in the workspace
                for op in new_wiring["operators"].values():
                    # Name is vendor/name/version
                    # Check if it's a match to update
                    if len(widget_details) == 3:
                        if op["name"] == f"{widget_details[0]}/{widget_details[1]}/{widget_details[2]}":
                            count += 1
                            op["name"] = f"{widget_details[0]}/{widget_details[1]}/{options['new_version']}"
                    elif len(widget_details) == 2:
                        if op["name"].startswith(f"{widget_details[0]}/{widget_details[1]}/") and \
                           op["name"] != f"{widget_details[0]}/{widget_details[1]}/{options['new_version']}":
                            count += 1
                            op["name"] = f"{widget_details[0]}/{widget_details[1]}/{options['new_version']}"
                WiringEntry.checkWiring(None, None, new_wiring, old_wiring)
                workspace.wiringStatus = new_wiring
            if count == 0:
                print(
                    f"No operators to update for {options['widget']} to {options['new_version']} for user {options['user']}")
                return
            # Ask for confirmation
            print(
                f"Updating {count} operators of {options['widget']} to {options['new_version']} for user {options['user']}")
            answer = input("Are you sure you want to update them? (yes/no): ")
            if answer != 'yes':
                print("Aborted")
                return
            for workspace in workspaces:
                workspace.save()
            print(f"Updated {count} operators")
