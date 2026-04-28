from django.urls import path
from django.views.generic import TemplateView
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('profile/customer/', TemplateView.as_view(template_name='profile_customer.html'), name='profile_customer'),
    path('profile/organizer/', TemplateView.as_view(template_name='profile_organizer.html'), name='profile_organizer'),
    path('register/', TemplateView.as_view(template_name='register.html'), name='register'),
    path('register/customer/', TemplateView.as_view(template_name='register_customer.html'), name='register_customer'),
    path('register/organizer/', TemplateView.as_view(template_name='register_organizer.html'), name='register_organizer'),
    path('register/admin/', TemplateView.as_view(template_name='register_admin.html'), name='register_admin'),
    path('venue/', TemplateView.as_view(template_name='venue_management.html'), name='venue_management'),
    path('manajemen/artis/', TemplateView.as_view(template_name='manajemen_artis.html'), name='manajemen_artis'),
    path('manajemen/tiket/', TemplateView.as_view(template_name='my_tickets.html'), name='manajemen_tiket'),
    path('my-tickets-cust/', TemplateView.as_view(template_name='my_tickets.html', extra_context={'role': 'cust'}), name='my_tickets_cust'),
    path('my-tickets-org/', TemplateView.as_view(template_name='my_tickets.html', extra_context={'role': 'org'}), name='my_tickets_org'),
    path('my-tickets-admin/', TemplateView.as_view(template_name='my_tickets.html', extra_context={'role': 'admin'}), name='my_tickets_admin'),
    path('seats-cust/', TemplateView.as_view(template_name='seats.html', extra_context={'role': 'cust'}), name='seats_cust'),
    path('seats-org/', TemplateView.as_view(template_name='seats.html', extra_context={'role': 'org'}), name='seats_org'),
    path('seats-admin/', TemplateView.as_view(template_name='seats.html', extra_context={'role': 'admin'}), name='seats_admin'),
]