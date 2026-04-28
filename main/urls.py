from django.urls import path
from django.views.generic import TemplateView
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('my-tickets-admin/', TemplateView.as_view(template_name='my_tickets.html'), name='my_tickets_admin'),
    path('my-tickets-org/', TemplateView.as_view(template_name='my_tickets.html'), name='my_tickets_org'),
    path('my-tickets-cust/', TemplateView.as_view(template_name='my_tickets.html'), name='my_tickets_cust'),
    path('my-tickets/', TemplateView.as_view(template_name='my_tickets.html'), name='my_tickets'),
    path('register/', TemplateView.as_view(template_name='register.html'), name='register'),
    path('register/customer/', TemplateView.as_view(template_name='register_customer.html'), name='register_customer'),
    path('register/organizer/', TemplateView.as_view(template_name='register_organizer.html'), name='register_organizer'),
    path('register/admin/', TemplateView.as_view(template_name='register_admin.html'), name='register_admin'),
    
]