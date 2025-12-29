# Content Management - NotebookLM MCP

> Add sources, generate audio overviews, briefings, study guides, and more

---

## Overview

The Content Management module enables you to:

1. **Add Sources** - Upload documents, URLs, text, YouTube videos to notebooks
2. **Generate Audio** - Create podcast-style audio overviews
3. **Generate Content** - Create briefings, study guides, FAQs, timelines
4. **Create Notes with Research** - AI-powered research notes (fast or deep mode)
5. **List & Download** - View content and download generated files

---

## Quick Start

### Add a URL Source

```bash
curl -X POST http://localhost:3000/content/sources \
  -H "Content-Type: application/json" \
  -d '{
    "source_type": "url",
    "url": "https://example.com/article"
  }'
```

### Generate Audio Overview

```bash
curl -X POST http://localhost:3000/content/audio \
  -H "Content-Type: application/json" \
  -d '{
    "custom_instructions": "Focus on practical tips"
  }'
```

### Generate Study Guide

```bash
curl -X POST http://localhost:3000/content/generate \
  -H "Content-Type: application/json" \
  -d '{
    "content_type": "study_guide"
  }'
```

### Create Note with Research

```bash
# Fast research (1-2 minutes)
curl -X POST http://localhost:3000/content/notes \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Summary of key concepts",
    "mode": "fast"
  }'

# Deep research (3-5 minutes)
curl -X POST http://localhost:3000/content/notes \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Comprehensive analysis",
    "mode": "deep"
  }'
```

---

## Source Types

| Type           | Description                 | Required Field |
| -------------- | --------------------------- | -------------- |
| `file`         | Local file upload           | `file_path`    |
| `url`          | Web page URL                | `url`          |
| `text`         | Plain text / pasted content | `text`         |
| `youtube`      | YouTube video URL           | `url`          |
| `google_drive` | Google Drive document link  | `url`          |

### Examples

**Upload a local file:**

```bash
curl -X POST http://localhost:3000/content/sources \
  -H "Content-Type: application/json" \
  -d '{
    "source_type": "file",
    "file_path": "/path/to/document.pdf",
    "title": "My PDF Document"
  }'
```

**Add pasted text:**

```bash
curl -X POST http://localhost:3000/content/sources \
  -H "Content-Type: application/json" \
  -d '{
    "source_type": "text",
    "text": "Your document content here...",
    "title": "Research Notes"
  }'
```

**Add YouTube video:**

```bash
curl -X POST http://localhost:3000/content/sources \
  -H "Content-Type: application/json" \
  -d '{
    "source_type": "youtube",
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }'
```

---

## Content Generation Types

| Type                | Description                     | Typical Time |
| ------------------- | ------------------------------- | ------------ |
| `audio_overview`    | Podcast-style audio overview    | 5-10 min     |
| `briefing_doc`      | Executive summary / briefing    | 30-60 sec    |
| `study_guide`       | Study guide with learning cards | 30-60 sec    |
| `faq`               | Frequently asked questions      | 30-60 sec    |
| `timeline`          | Chronological timeline          | 30-60 sec    |
| `table_of_contents` | Table of contents / outline     | 30-60 sec    |

### Audio Overview

The audio overview creates a podcast-style discussion between two AI hosts about your notebook content.

```bash
curl -X POST http://localhost:3000/content/audio \
  -H "Content-Type: application/json" \
  -d '{
    "custom_instructions": "Focus on key concepts for beginners, use simple language"
  }'
```

**Custom Instructions Ideas:**

- "Focus on practical applications"
- "Emphasize the historical context"
- "Make it accessible to students"
- "Highlight the key takeaways"

### Briefing Document

Creates an executive summary of your sources.

```bash
curl -X POST http://localhost:3000/content/generate \
  -H "Content-Type: application/json" \
  -d '{
    "content_type": "briefing_doc"
  }'
```

### Study Guide

Creates learning materials with key concepts and practice questions.

```bash
curl -X POST http://localhost:3000/content/generate \
  -H "Content-Type: application/json" \
  -d '{
    "content_type": "study_guide",
    "custom_instructions": "Include 10 practice questions"
  }'
```

### FAQ

Generates frequently asked questions based on your sources.

```bash
curl -X POST http://localhost:3000/content/generate \
  -H "Content-Type: application/json" \
  -d '{
    "content_type": "faq"
  }'
```

### Timeline

Creates a chronological timeline of events from your sources.

```bash
curl -X POST http://localhost:3000/content/generate \
  -H "Content-Type: application/json" \
  -d '{
    "content_type": "timeline"
  }'
```

---

## Research Notes (Fast & Deep)

Create AI-powered research notes from your notebook sources. Two modes are available:

### Research Modes

| Mode   | Description                              | Time    | Use Case                   |
| ------ | ---------------------------------------- | ------- | -------------------------- |
| `fast` | Quick research, essential findings       | 1-2 min | Quick summaries, overviews |
| `deep` | Thorough research, comprehensive results | 3-5 min | In-depth analysis, reports |

### Fast Research

Quick research for essential findings:

```bash
curl -X POST http://localhost:3000/content/notes \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "What are the main takeaways?",
    "mode": "fast"
  }'
```

### Deep Research

Thorough research for comprehensive analysis:

```bash
curl -X POST http://localhost:3000/content/notes \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Analyze the historical context and implications",
    "mode": "deep",
    "custom_instructions": "Include dates and key figures"
  }'
```

### Response

```json
{
  "success": true,
  "data": {
    "success": true,
    "mode": "deep",
    "status": "ready",
    "title": "Historical Analysis",
    "content": "## Key Findings\n\n..."
  }
}
```

---

## Listing Content

View all sources and generated content in a notebook:

```bash
curl http://localhost:3000/content
```

**Response:**

```json
{
  "success": true,
  "sources": [
    {
      "id": "source-1",
      "name": "Introduction.pdf",
      "type": "document",
      "status": "ready"
    },
    {
      "id": "source-2",
      "name": "https://example.com",
      "type": "url",
      "status": "ready"
    }
  ],
  "generatedContent": [
    {
      "id": "audio-overview",
      "type": "audio_overview",
      "name": "Audio Overview",
      "status": "ready",
      "createdAt": "2025-12-24T10:30:00Z"
    }
  ],
  "sourceCount": 2,
  "hasAudioOverview": true
}
```

---

## Downloading Audio

Download the generated audio file:

```bash
# Get audio URL
curl http://localhost:3000/content/audio/download

# Save to specific path
curl "http://localhost:3000/content/audio/download?output_path=/downloads/podcast.wav"
```

**Response:**

```json
{
  "success": true,
  "filePath": "/downloads/podcast.wav",
  "mimeType": "audio/wav"
}
```

---

## MCP Tool Usage

If using Claude Code or Claude Desktop:

### Add Source

```
add_source(source_type="url", url="https://example.com")
```

### Generate Audio

```
generate_audio(custom_instructions="Focus on key points")
```

### Generate Content

```
generate_content(content_type="study_guide")
```

### List Content

```
list_content()
```

### Download Audio

```
download_audio(output_path="/path/to/save.wav")
```

### Add Research Note

```
add_note(topic="Summary of key findings", mode="fast")
add_note(topic="Comprehensive analysis", mode="deep", custom_instructions="Include statistics")
```

---

## Workflow Examples

### Research Workflow

1. Add multiple sources:

   ```bash
   # Add primary source
   curl -X POST http://localhost:3000/content/sources \
     -d '{"source_type":"url","url":"https://research-paper.com"}'

   # Add supporting document
   curl -X POST http://localhost:3000/content/sources \
     -d '{"source_type":"file","file_path":"/docs/notes.pdf"}'
   ```

2. Generate overview materials:

   ```bash
   # Create briefing
   curl -X POST http://localhost:3000/content/generate \
     -d '{"content_type":"briefing_doc"}'

   # Create FAQ
   curl -X POST http://localhost:3000/content/generate \
     -d '{"content_type":"faq"}'
   ```

### Learning Workflow

1. Add educational content:

   ```bash
   curl -X POST http://localhost:3000/content/sources \
     -d '{"source_type":"youtube","url":"https://youtube.com/watch?v=VIDEO"}'
   ```

2. Generate study materials:

   ```bash
   # Study guide
   curl -X POST http://localhost:3000/content/generate \
     -d '{"content_type":"study_guide"}'

   # Audio for revision
   curl -X POST http://localhost:3000/content/audio \
     -d '{"custom_instructions":"Explain like teaching a beginner"}'
   ```

3. Download audio for offline study:
   ```bash
   curl http://localhost:3000/content/audio/download?output_path=study.wav
   ```

---

## Error Handling

### Common Errors

| Error                    | Cause                  | Solution                         |
| ------------------------ | ---------------------- | -------------------------------- |
| "Source type required"   | Missing `source_type`  | Add the `source_type` parameter  |
| "File not found"         | Invalid `file_path`    | Check file path exists           |
| "Content type required"  | Missing `content_type` | Add the `content_type` parameter |
| "Audio not ready"        | Audio still generating | Wait and retry                   |
| "No sources in notebook" | Empty notebook         | Add sources first                |

### Timeout Handling

Audio generation can take 5-10 minutes. The API will wait up to 10 minutes for completion. For long operations, consider:

1. Using `session_id` to maintain context
2. Polling `list_content` to check status
3. Setting appropriate client timeouts

---

## Best Practices

1. **Add sources before generating content** - Ensure your notebook has sources before attempting to generate audio or documents.

2. **Use custom instructions** - Tailor generated content by providing clear custom instructions.

3. **Reuse sessions** - Pass `session_id` to avoid creating new browser sessions for each request.

4. **Check content list** - Use `list_content` to verify what's already generated before creating duplicates.

5. **Handle timeouts gracefully** - Audio generation is slow; implement appropriate retry logic.

---

## Version History

| Version | Changes                                |
| ------- | -------------------------------------- |
| 1.4.1   | Added research notes (fast/deep modes) |
| 1.4.0   | Added content management module        |
| 1.3.7   | Source citation extraction             |
| 1.3.6   | Multi-account support                  |

---

**Complete Content Management Documentation!**
