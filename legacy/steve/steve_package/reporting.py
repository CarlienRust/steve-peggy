# File Handling & PDF Processing
import PyPDF2
from PyPDF2 import PdfMerger
from PIL import Image
import tempfile
import fitz
import io, os, tempfile

# Report Generation
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors

#--------------------------------------------------
# Step 10: Downloadable report: Function to generate a data quality report
#--------------------------------------------------

# Define required columns
REQUIRED_COLUMNS = {"ID"}  # Adjust as needed

# Function to generate a data quality report
def generate_data_quality_report(cleaned_dfs, file_names):
    report = []
    for df, file_name in zip(cleaned_dfs, file_names):
        id_column = df.get("ID", pd.Series(dtype=object))

        file_report = {
            "File Name": file_name,
            "Total Rows": len(df),
            "Total Columns": len(df.columns),
            "Missing Participant IDs": int(id_column.isna().sum()),
            "Duplicate Participant IDs": int(id_column.duplicated().sum()),
            "Missing Values (Any Column)": int(df.isna().sum().sum()),
            "Missing Required Columns": ", ".join(map(str, REQUIRED_COLUMNS - set(df.columns))),
        }
        report.append(file_report)

    report_df = pd.DataFrame(report)

    if "pdf_content" not in st.session_state:
        st.session_state.pdf_content = []

    text = f"**Data quality summary:** \n {report_df.to_string(index=False)}"
    st.session_state.pdf_content.append({"text": text, 
                                         "figure": None})
    
    return report_df

# Function to create a standalone PDF page from text and optional figure
def append_to_pdf(text, fig=None):
    page_width, page_height = letter
    margin = 50  # 1-inch margins

    pdf_buffer = io.BytesIO()
    c = canvas.Canvas(pdf_buffer, pagesize=letter)

    # Header for each page (optional)
    def add_header():
        c.setFont("Helvetica-Bold", 12)
        c.drawString(margin, page_height - margin + 10, "Final Report of Results")

    # Draw text content (handles long text across pages)
    def draw_text_block(text, start_y):
        c.setFont("Helvetica", 10)
        y_position = start_y
        for line in text.split("\n"):
            c.drawString(margin, y_position, line)
            y_position -= 14
            if y_position < margin + 100:  # Trigger new page
                c.showPage()
                add_header()
                c.setFont("Helvetica", 10)
                y_position = page_height - margin - 30
        return y_position

    # Process text (if it's a list, join it into a string)
    if isinstance(text, list):
        text = "\n".join(text)

    # Add header and draw text block
    add_header()
    y_position = draw_text_block(text, page_height - margin - 30)

    # Add plot if provided
    if fig:
        img_bytes = fig.to_image(format="png", engine="kaleido")
        img_stream = io.BytesIO(img_bytes)
        img = Image.open(img_stream).convert("RGB")

        # Scale image to fit page (leave margins)
        max_img_width = page_width - 2 * margin
        max_img_height = y_position - margin - 20
        img.thumbnail((max_img_width, max_img_height), Image.LANCZOS)

        # New page if no space left for image
        if y_position - img.height < margin:
            c.showPage()
            add_header()
            y_position = page_height - margin - 30

        # Center image horizontally
        img_x = (page_width - img.width) / 2
        img_y = y_position - img.height

        # Save and draw image
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_img:
            img.save(temp_img, format="PNG")
            temp_img_path = temp_img.name

        c.drawImage(temp_img_path, img_x, img_y, width=img.width, height=img.height)

        # Clean up temp file
        os.remove(temp_img_path)

        # Update position after image (optional space for footer)
        y_position = img_y - 20

    c.showPage()
    c.save()

    pdf_buffer.seek(0)
    return pdf_buffer

# Helper function to save the plot as an image (assumes fig is a plotly figure)
def save_plot_as_image(fig):
    if fig is None:
        raise ValueError("Figure is None, cannot save.")
    try:
        img_bytes = fig.to_image(format="png", engine="kaleido")
        return img_bytes
    except Exception as e:
        raise ValueError(f"Error saving plot as image: {e}")

def save_plot_as_png(fig, output_path):
    if fig is None:
        raise ValueError("Figure is None, unable to save it.")
    try:
        fig.write_image(output_path, format="png", engine="kaleido")
    except Exception as e:
        raise ValueError(f"An error occurred while saving the figure as PNG: {e}")

