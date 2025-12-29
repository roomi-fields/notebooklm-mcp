# Content Management - NotebookLM MCP

> Add sources and generate audio overviews (podcasts)

---

## Overview

The Content Management module enables you to:

1. **Add Sources** - Upload documents, URLs, text, YouTube videos to notebooks
2. **Generate Audio Overview** - Create podcast-style audio discussions (REAL NotebookLM feature)
3. **Download Audio** - Save generated audio files locally
4. **List Content** - View sources and generated content

---

## Important: What We Actually Support

**REAL NotebookLM Features (fully integrated):**

- Audio Overview generation - Uses NotebookLM's actual podcast feature
- Audio download - Downloads the real generated audio file
- Source management - Add files, URLs, text, YouTube videos
- Q&A with citations - Uses NotebookLM's actual chat

**NOT Supported (removed in v1.4.2):**

The following were removed because they were NOT real NotebookLM integrations. They were just sending prompts to the chat, which you can do yourself with `ask_question`:

- ~~Briefing Doc~~ - Just asked chat to generate a summary
- ~~Study Guide~~ - Just asked chat to create study materials
- ~~FAQ~~ - Just asked chat to generate FAQs
- ~~Timeline~~ - Just asked chat to create a timeline
- ~~Table of Contents~~ - Just asked chat to create a TOC

If you need these, simply use `ask_question` with your own prompt like "Create a study guide" or "Generate an FAQ".

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

### Download Audio

```bash
curl http://localhost:3000/content/audio/download
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

## Audio Overview (Podcast)

The audio overview creates a podcast-style discussion between two AI hosts about your notebook content. This is a REAL NotebookLM feature that generates actual audio.

### Generate Audio

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

**Note:** Audio generation takes 5-10 minutes. The API will wait for completion.

### Download Audio

```bash
# Get audio file
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

### List Content

```
list_content()
```

### Download Audio

```
download_audio(output_path="/path/to/save.wav")
```

---

## Workflow Example

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

2. Generate audio overview:

   ```bash
   curl -X POST http://localhost:3000/content/audio \
     -d '{"custom_instructions":"Summarize key findings for researchers"}'
   ```

3. Download for offline listening:
   ```bash
   curl http://localhost:3000/content/audio/download?output_path=research.wav
   ```

---

## Error Handling

### Common Errors

| Error                    | Cause                 | Solution                        |
| ------------------------ | --------------------- | ------------------------------- |
| "Source type required"   | Missing `source_type` | Add the `source_type` parameter |
| "File not found"         | Invalid `file_path`   | Check file path exists          |
| "Audio not ready"        | Audio still generating| Wait and retry                  |
| "No sources in notebook" | Empty notebook        | Add sources first               |

### Timeout Handling

Audio generation can take 5-10 minutes. The API will wait up to 10 minutes for completion. For long operations, consider:

1. Using `session_id` to maintain context
2. Polling `list_content` to check status
3. Setting appropriate client timeouts

---

## Best Practices

1. **Add sources before generating audio** - Ensure your notebook has sources before attempting to generate audio.

2. **Use custom instructions** - Tailor the audio by providing clear custom instructions.

3. **Reuse sessions** - Pass `session_id` to avoid creating new browser sessions for each request.

4. **Check content list** - Use `list_content` to verify what's already generated before creating duplicates.

5. **Handle timeouts gracefully** - Audio generation is slow; implement appropriate retry logic.

---

## Version History

| Version | Changes                                           |
| ------- | ------------------------------------------------- |
| 1.4.2   | Removed fake content generation (FAQ, etc.)      |
| 1.4.0   | Added content management module                   |
| 1.3.7   | Source citation extraction                        |

---

**Complete Content Management Documentation!**
