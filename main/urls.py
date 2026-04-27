from django.urls import path
from django.views.generic import TemplateView
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('register/', TemplateView.as_view(template_name='register.html'), name='register'),
    path('register/customer/', TemplateView.as_view(template_name='register_customer.html'), name='register_customer'),
    path('register/organizer/', TemplateView.as_view(template_name='register_organizer.html'), name='register_organizer'),
    path('register/admin/', TemplateView.as_view(template_name='register_admin.html'), name='register_admin'),
    path('manajemen/artis/', TemplateView.as_view(template_name='manajemen_artis.html'), name='manajemen_artis'),
    path('manajemen/tiket/', TemplateView.as_view(template_name='manajemen_tiket.html'), name='manajemen_tiket'),
]