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
]