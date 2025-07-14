# HC PDF Generator

Generate PDFs from JSON using Puppeteer + Handlebars. Works as a CLI tool or programmatically in Node.

## How to run locally
`node index.js test.json test-output.pdf`

## How to install on a project
`npm install git+https://github.com/TarekHolanda/pdf-generator.git#branch_name`

## How to use it with Python API
```
# Create temporary files for input and output
with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as input_file:
    json.dump(payload, input_file)
    input_path = input_file.name

with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as output_file:
    output_path = output_file.name

try:
    # Call the Node.js script with file arguments
    process = subprocess.Popen(
        ["node", "node_modules/@tarekholanda/hc-pdf-generator/index.js", input_path, output_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    stdout, stderr = process.communicate()
    
    if process.returncode != 0:
        return JsonResponse({"error": stderr.decode("utf-8")}, status=500)
    
    # Read the generated PDF file
    with open(output_path, "rb") as pdf_file:
        pdf_content = pdf_file.read()
    
    # Return the PDF as a downloadable file
    response = HttpResponse(pdf_content, content_type="application/pdf")
    response["Content-Disposition"] = "attachment; filename=generated.pdf"
    return response

except Exception as e:
    return JsonResponse({"error": str(e)}, status=500)
finally:
    # Clean up temporary files
    try:
        os.unlink(input_path)
        os.unlink(output_path)
    except OSError:
        pass  # Files might already be deleted
```
