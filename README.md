## Multifunctional Browser Extension for Accessibility

### **Setting up Django**

1. Extract all the files into one folder.

2. Create a Virtual Environment to install dependencies:
    ```bash
    python -m venv venv
    source venv/bin/activate
    ```

3. Install all dependencies from the `requirements.txt` file:
    ```bash
    pip install -r requirements.txt
    ```

4. Set your `GROQ_API_KEY` from groqcloud and `HF_TOKEN` from huggingface in a `.env.` file

5. Move to the main app folder and perform migrations:
    ```bash
    cd inText
    python manage.py makemigrations
    python manage.py migrate
    ```

6. Run the server:
    ```bash
    python manage.py runserver
    ```

### **Setting up the Extension in Your Browser**

1. Open the browser and navigate to the extensions page.

2. Click on the "Load unpacked" button.

3. Navigate to the `web-extension` folder and select it.

4. Perform the required actions from the extension interface.