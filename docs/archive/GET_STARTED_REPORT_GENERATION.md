# 🚀 GET STARTED - Report Generation System

## Quick Start in 5 Minutes

### Step 1: Import the Dashboard Component
```typescript
import { ReportGenerationDashboard } from '@/components/reporting';

export default function ReportsPage() {
  return <ReportGenerationDashboard />;
}
```

That's it! The dashboard is ready to use with:
- Report type selection
- Format selection
- Template customization
- Progress tracking
- Report preview
- Download functionality

### Step 2: Use the React Hook in Your Component
```typescript
import { useReportGeneration } from '@/hooks';

export function MyReportComponent() {
  const {
    state: { isGenerating, progress, report, error },
    generateReport,
    downloadReport
  } = useReportGeneration();

  const handleClick = async () => {
    await generateReport({
      category: 'DETAILED',
      format: 'PDF',
      data: {
        project: { name: 'My Project' },
        // ... other project data
      }
    });
  };

  return (
    <div>
      <button onClick={handleClick} disabled={isGenerating}>
        {isGenerating ? `Generating... ${progress}%` : 'Generate Report'}
      </button>
      {error && <div className="error">{error}</div>}
      {report && <button onClick={downloadReport}>Download</button>}
    </div>
  );
}
```

### Step 3: Preview Reports
```typescript
import { ReportPreviewPanel } from '@/components/reporting';

<ReportPreviewPanel 
  reportUrl={pdfUrl}
  title="My Structural Report"
  onAnnotate={(annotation) => console.log(annotation)}
/>
```

---

## 📚 Common Use Cases

### Generate a Detailed Report
```typescript
const { generateReport } = useReportGeneration();

await generateReport({
  category: 'DETAILED',
  format: 'PDF',
  data: {
    project: {
      name: 'Bridge Retrofit',
      location: 'Mumbai'
    },
    engineer: {
      name: 'John Doe',
      pe: 'PE123'
    },
    company: {
      name: 'ABC Structures'
    },
    designCode: 'IS 800:2007',
    // ... more project data
  }
});
```

### Generate Code Compliance Report
```typescript
const { generateReport } = useReportGeneration();

await generateReport({
  category: 'COMPLIANCE',
  format: 'PDF',
  data: {
    // Compliance specific data
    designCode: 'IS 800:2007',
    checks: [
      // Compliance check data
    ]
  }
});
```

### Generate Calculation Sheets
```typescript
const { generateReport } = useReportGeneration();

await generateReport({
  category: 'CALCULATION_SHEET',
  format: 'PDF',
  data: {
    // Calculation data
    type: 'STEEL_BEAM',
    sections: [
      // Calculation steps
    ]
  }
});
```

### Batch Generate Multiple Reports
```typescript
const { generateBatch } = useReportGeneration();

await generateBatch([
  {
    category: 'DETAILED',
    format: 'PDF',
    data: project1Data
  },
  {
    category: 'DETAILED',
    format: 'PDF',
    data: project2Data
  }
]);
```

---

## 🛠️ Configuration Options

### Report Generation Settings
```typescript
{
  category: 'DETAILED' | 'CALCULATION_SHEET' | 'COMPLIANCE',
  format: 'PDF' | 'DOCX' | 'HTML' | 'XLSX',
  template: 'default' | 'minimal' | 'detailed',
  branding: {
    companyName: 'Your Company',
    logo: 'url/to/logo.png',
    primaryColor: '#1e40af'
  },
  data: { /* project data */ }
}
```

### Report Preview Settings
```typescript
{
  reportUrl: 'url/to/report.pdf',
  title: 'Report Title',
  onAnnotate: (annotation) => handleAnnotation(annotation),
  allowDownload: true,
  allowPrint: true,
  zoomLevel: 100
}
```

---

## 📊 Supported Design Codes

### Full Implementation (with clause checks)
- ✅ IS 800:2007 (Steel Structures)
- ✅ IS 1893:2016 (Seismic Code)

### Framework Ready (can be extended)
- 🔜 IS 456:2000 (Concrete)
- 🔜 IS 13920:2016 (Ductile Design)
- 🔜 AISC 360-16 (USA Steel)
- 🔜 ACI 318-19 (USA Concrete)
- 🔜 ASCE 7-22 (USA Wind/Seismic)
- 🔜 Eurocode 2 (EU Concrete)
- 🔜 Eurocode 3 (EU Steel)
- 🔜 BS 5950 (UK Steel)
- 🔜 CSA S16-19 (Canada Steel)
- 🔜 AS 4100 (Australia Steel)

---

## 🎯 Complete API Reference

### ReportGenerationDashboard Component
```typescript
<ReportGenerationDashboard />

// Props: None required (can be extended)
// Features:
// - Report type selection
// - Format selection
// - Template selection
// - Branding configuration
// - Generation progress
// - Report history
// - Download functionality
```

### useReportGeneration Hook
```typescript
const {
  state: {
    isGenerating: boolean,
    progress: number,    // 0-100
    report: Report | null,
    error: string | null,
    reports: Report[]
  },
  generateReport: (request: GenerationRequest) => Promise<Report>,
  generateBatch: (requests: GenerationRequest[]) => Promise<Report[]>,
  downloadReport: (report: Report) => void,
  printReport: (report: Report) => void,
  previewReport: (report: Report) => void,
  clearReports: () => void
} = useReportGeneration()
```

### ReportPreviewPanel Component
```typescript
<ReportPreviewPanel
  reportUrl={string}           // URL to PDF
  title={string}               // Report title
  onAnnotate={(note) => void}  // Annotation callback
  allowDownload={boolean}      // Default: true
  allowPrint={boolean}         // Default: true
  zoomLevel={number}           // Default: 100
/>

// Features:
// - Page thumbnails
// - Zoom controls (50-200%)
// - Bookmarks
// - Annotations
// - Fullscreen
// - Print preview
```

---

## 🧪 Testing the System

### Manual Testing Steps
1. Navigate to reports page with ReportGenerationDashboard
2. Select "Detailed Report" type
3. Select "PDF" format
4. Enter project details in the form
5. Click "Generate Report"
6. Wait for progress to complete (5-10 seconds)
7. Preview report in modal
8. Download or print as needed

### Testing Compliance Reports
1. Select "Code Compliance" report type
2. Choose design code (IS 800:2007, IS 1893:2016)
3. Input structural design data
4. Generate report
5. Verify compliance checks are correct
6. Check for non-compliance alerts

### Testing Calculation Sheets
1. Select "Calculation Sheet" report type
2. Choose calculation type (Steel Beam, Column, Connection)
3. Input design parameters
4. Generate report
5. Verify calculations are documented
6. Check formula references

---

## ⚠️ Common Issues & Solutions

### Report Generation Times Out
**Problem**: Report generation takes >30 seconds or fails  
**Solutions**:
- Check system memory availability
- Reduce report scope (fewer pages)
- Try single report instead of batch
- Check browser console for errors

### PDF Preview Won't Load
**Problem**: Report preview shows blank or error  
**Solutions**:
- Verify PDF URL is accessible
- Check browser console for errors
- Ensure report was generated successfully
- Try downloading instead of preview

### Missing Compliance Checks
**Problem**: Compliance report missing expected checks  
**Solutions**:
- Verify design code is correctly selected
- Check that input data is complete
- Ensure design code templates are loaded
- Review compliance data format

### Slow Performance
**Problem**: Report generation is slow  
**Solutions**:
- First generation slower (no cache)
- Subsequent reports use cache (faster)
- Batch operations process in parallel
- Large reports (100+ pages) take longer

---

## 📈 Performance Tips

### For Faster Generation
1. Use cached reports when possible
2. Batch generate multiple reports together
3. Use minimal template instead of detailed
4. Reduce report scope where applicable

### For Better UX
1. Show progress bar during generation
2. Use skeleton loader while waiting
3. Cache reports for 1 hour
4. Pre-generate reports when possible

### For Scalability
1. Implement server-side generation for batch
2. Use queue system for large batches
3. Store reports in database
4. Implement background jobs

---

## 📚 Documentation Files to Review

| Document | Purpose | Read Time |
|----------|---------|-----------|
| REPORT_GENERATION_QUICKREF.md | Quick reference | 5 min |
| REPORT_GENERATION_INTEGRATION.md | Full API docs | 15 min |
| REPORT_GENERATION_COMPLETE.md | Architecture | 10 min |
| COMPLETE_FILE_INVENTORY.md | File descriptions | 5 min |

---

## 🎓 Learning Path

### Beginner (5 minutes)
- Read this file (GET_STARTED.md)
- Use ReportGenerationDashboard component
- Test report generation

### Intermediate (30 minutes)
- Read REPORT_GENERATION_QUICKREF.md
- Review usage examples
- Customize report generation
- Test with your data

### Advanced (1-2 hours)
- Read REPORT_GENERATION_INTEGRATION.md
- Study component internals
- Review service architecture
- Extend with custom features

### Expert (2-4 hours)
- Review all files in /modules/reporting
- Study DetailedReportEngine.ts
- Understand type system
- Implement custom design codes

---

## 🚀 Next Steps

### Immediate (Do Now)
1. ✅ Import ReportGenerationDashboard
2. ✅ Add to your routes
3. ✅ Test basic generation

### Short Term (Next Sprint)
1. Integrate with your project management
2. Add email distribution
3. Customize branding
4. Add to project detail pages

### Medium Term (Next Month)
1. Implement report scheduling
2. Add batch generation UI
3. Create custom templates
4. Add team collaboration

### Long Term (Next Quarter)
1. DOCX/HTML/XLSX export
2. Digital signatures
3. Report versioning
4. Analytics dashboard

---

## 💡 Pro Tips

### Tip 1: Cache Reports
Reports are cached for 1 hour by default. Same generation request will be instant on second call.

### Tip 2: Batch Generation
Generate multiple reports at once with `generateBatch()` for better performance.

### Tip 3: Template Selection
Use 'minimal' template for quick reports, 'detailed' for comprehensive documentation.

### Tip 4: Design Code Selection
Choose the correct design code upfront to ensure compliance checks are relevant.

### Tip 5: Progress Tracking
Always show progress during generation to keep users informed (5-10 seconds typical).

---

## 🎉 You're Ready!

The report generation system is ready to use. Start with:

```typescript
import { ReportGenerationDashboard } from '@/components/reporting';

export default function ReportsPage() {
  return <ReportGenerationDashboard />;
}
```

That's all you need. Everything else is handled by the system!

---

## 📞 Need Help?

- **API Docs**: See REPORT_GENERATION_INTEGRATION.md
- **Quick Ref**: See REPORT_GENERATION_QUICKREF.md
- **Architecture**: See REPORT_GENERATION_COMPLETE.md
- **File Details**: See COMPLETE_FILE_INVENTORY.md

---

**Happy Reporting! 🎊**

Version: 1.0.0  
Status: Production Ready  
Last Updated: 2025
