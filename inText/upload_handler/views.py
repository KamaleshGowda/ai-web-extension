from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
# Add any other necessary imports

@csrf_exempt
def upload_file_view(request):
    if request.method == 'POST':
        if 'file' in request.FILES:
            uploaded_file = request.FILES['file']
            # Here you would save the file or its content
            # You might want to store it temporarily and return an identifier
            # that can be used by the summarize and query views.

            # For now, let's just return a success message with the filename
            file_name = uploaded_file.name
            # In a real application, you'd want to handle file saving properly
            # and potentially extract text content here.
            return JsonResponse({"message": f"File '{file_name}' uploaded successfully!", "filename": file_name})
        else:
            return JsonResponse({"error": "No file was uploaded."}, status=400)
    else:
        return JsonResponse({"error": "Invalid request method. Only POST allowed."}, status=400)