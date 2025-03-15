from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from core.models import EmailFile, RuleGeneration


class Command(BaseCommand):
    help = 'Associate existing data with a specific user'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='Username to associate data with')

    def handle(self, *args, **options):
        username = options['username']

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'User {username} does not exist'))
            return

        # Associate EmailFile objects
        email_files_updated = EmailFile.objects.filter(user__isnull=True).update(user=user)

        # Associate RuleGeneration objects
        rule_gens_updated = RuleGeneration.objects.filter(user__isnull=True).update(user=user)

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully associated {email_files_updated} email files and '
                f'{rule_gens_updated} rule generations with user {username}'
            )
        )
