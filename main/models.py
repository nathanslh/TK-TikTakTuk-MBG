import uuid
from django.db import models

class Role(models.Model):
    role_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role_name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.role_name

class UserAccount(models.Model):
    user_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=100, unique=True)
    password = models.CharField(max_length=255)
    # Relasi Many-to-Many ke Role
    roles = models.ManyToManyField(Role, related_name='users')

    def __str__(self):
        return self.username

class Customer(models.Model):
    customer_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=100)
    email = models.EmailField(max_length=100, null=True, blank=True)
    phone_number = models.CharField(max_length=20, null=True, blank=True)
    # OneToOne karena satu user hanya bisa jadi satu customer
    user = models.OneToOneField(UserAccount, on_delete=models.CASCADE)

class Organizer(models.Model):
    organizer_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organizer_name = models.CharField(max_length=100)
    contact_email = models.EmailField(max_length=100, null=True, blank=True)
    user = models.OneToOneField(UserAccount, on_delete=models.CASCADE)

class Venue(models.Model):
    venue_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    venue_name = models.CharField(max_length=100)
    capacity = models.PositiveIntegerField() # Sama dengan CHECK (capacity > 0)
    address = models.TextField()
    city = models.CharField(max_length=100)

class Seat(models.Model):
    seat_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    section = models.CharField(max_length=50)
    seat_number = models.CharField(max_length=10)
    row_number = models.CharField(max_length=10)
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE)

class Event(models.Model):
    event_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_datetime = models.DateTimeField()
    event_title = models.CharField(max_length=200)
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE)
    organizer = models.ForeignKey(Organizer, on_delete=models.CASCADE)

class Artist(models.Model):
    artist_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    genre = models.CharField(max_length=100, null=True, blank=True)
    # Many-to-Many ke Event melalui tabel perantara karena ada field 'role'
    events = models.ManyToManyField(Event, through='EventArtist')

class EventArtist(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    artist = models.ForeignKey(Artist, on_delete=models.CASCADE)
    role = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        unique_together = ('event', 'artist')

class TicketCategory(models.Model):
    category_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category_name = models.CharField(max_length=50)
    quota = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=12, decimal_places=2)
    event = models.ForeignKey(Event, on_delete=models.CASCADE)

class Order(models.Model):
    order_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_date = models.DateTimeField()
    payment_status = models.CharField(max_length=20)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)

class Ticket(models.Model):
    ticket_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket_code = models.CharField(max_length=100, unique=True)
    category = models.ForeignKey(TicketCategory, on_delete=models.CASCADE)
    order = models.ForeignKey(Order, on_delete=models.CASCADE)
    # HAS_RELATIONSHIP diterjemahkan ke Many-to-Many
    seats = models.ManyToManyField(Seat, related_name='tickets')

class Promotion(models.Model):
    DISCOUNT_TYPES = [
        ('NOMINAL', 'Nominal'),
        ('PERCENTAGE', 'Percentage'),
    ]
    promotion_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    promo_code = models.CharField(max_length=50, unique=True)
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPES)
    discount_value = models.DecimalField(max_digits=12, decimal_places=2)
    start_date = models.DateField()
    end_date = models.DateField()
    usage_limit = models.PositiveIntegerField()
    # ORDER_PROMOTION diterjemahkan ke Many-to-Many
    orders = models.ManyToManyField(Order, related_name='promotions')