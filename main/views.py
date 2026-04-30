from django.shortcuts import render


def home(request):
    return render(request, 'home.html')

def checkout_view(request):
    return render(request, 'checkout.html')

def order_list_view(request):
    context = {
        'user_role': 'admin' # ubah jadi 'organizer' atau 'customer' untuk melihat tampilan yang sesuai
    }
    return render(request, 'order_list.html', context)

def promotion_list(request):
    context = {
        'user_role': 'admin' # ubah jadi 'organizer' atau 'customer' untuk melihat tampilan yang sesuai 
    }
    return render(request, 'promotion_list.html', context)