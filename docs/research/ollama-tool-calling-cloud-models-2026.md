# Ollama Tool Calling & Cloud Models Research (2026)

**Date:** 2026-05-06  
**Sources:**

- [Ollama Tool Calling Documentation](https://docs.ollama.com/capabilities/tool-calling)
- [Ollama Cloud Models Blog](https://ollama.com/blog/cloud-models)
- [Streaming Tool Calling Blog](https://ollama.com/blog/streaming-tool)

## Summary

✅ **Ollama supports both local and cloud models**  
✅ **Tool calling is supported by many models**  
✅ **Cloud models work with the same API as local models**  
✅ **Streaming with tool calling is fully supported**

---

## Cloud Models

### Overview

Ollama introduced **cloud models in preview** (v0.12+) that allow running larger models on datacenter-grade hardware while keeping the same local development experience.

### Key Features

- **Same API** - Cloud models use identical API to local models
- **Privacy** - Ollama cloud does not retain your data
- **OpenAI-compatible** - Works with OpenAI-compatible API
- **Seamless integration** - Works with existing tools

### Available Cloud Models (2026)

| Model                      | Size | Use Case                    |
| -------------------------- | ---- | --------------------------- |
| `qwen3-coder:480b-cloud`   | 480B | Code generation, reasoning  |
| `gpt-oss:120b-cloud`       | 120B | General purpose, coding     |
| `gpt-oss:20b-cloud`        | 20B  | Lightweight general purpose |
| `deepseek-v3.1:671b-cloud` | 671B | Advanced reasoning          |

### Usage

```bash
# Download Ollama v0.12+
ollama run qwen3-coder:480b-cloud

# Pull a cloud model
ollama pull gpt-oss:120b-cloud

# List models (cloud models show SIZE as "-")
ollama ls
```

### Authentication

```bash
# Sign in to use cloud models
ollama signin

# Sign out
ollama signout
```

---

## Tool Calling Support

### Overview

Ollama supports **tool calling** (also known as function calling) which allows models to:

- Invoke tools autonomously
- Incorporate tool results into responses
- Execute multi-step agent loops
- Stream responses with tool calls in real-time

### Supported Models (2026)

**Local & Cloud Models with Tool Support:**

| Model Family  | Examples                                       | Notes                               |
| ------------- | ---------------------------------------------- | ----------------------------------- |
| **Qwen 3**    | `qwen3`, `qwen3-coder`                         | ✅ Full tool support, thinking mode |
| **Qwen 2.5**  | `qwen2.5`, `qwen2.5-coder`                     | ✅ Full tool support                |
| **Llama 3.1** | `llama3.1:8b`, `llama3.1:70b`, `llama3.1:405b` | ✅ Full tool support                |
| **Llama 4**   | `llama4`                                       | ✅ Full tool support                |
| **Devstral**  | `devstral`                                     | ✅ Full tool support                |
| **GPT-OSS**   | `gpt-oss:120b-cloud`, `gpt-oss:20b-cloud`      | ✅ Cloud models with tool support   |
| **DeepSeek**  | `deepseek-v3.1:671b-cloud`                     | ✅ Cloud model with tool support    |
| **Gemma 3**   | Custom fine-tuned versions                     | ⚠️ Requires fine-tuning for tools   |

**Browse more:** [Ollama Tool Models](https://ollama.com/search?c=tools)

### Tool Calling Patterns

#### 1. Single-Shot Tool Calling

Model invokes one tool and incorporates the result:

```javascript
const response = await ollama.chat({
  model: 'qwen3',
  messages: [{ role: 'user', content: 'What is the temperature in New York?' }],
  tools: [getTemperatureTool],
  think: true,
});
```

#### 2. Parallel Tool Calling

Model invokes multiple tools simultaneously:

```javascript
// Model can call get_temperature AND get_conditions for multiple cities
const response = await ollama.chat({
  model: 'qwen3',
  messages: [
    {
      role: 'user',
      content: 'What are the weather conditions and temperature in New York and London?',
    },
  ],
  tools: [getTemperatureTool, getConditionsTool],
  think: true,
});
```

#### 3. Agent Loop (Multi-Step)

Model decides when to invoke tools and continues until task complete:

```javascript
const messages = [{ role: 'user', content: 'What is (11434+12341)*412?' }];

while (true) {
  const response = await ollama.chat({
    model: 'qwen3',
    messages,
    tools: [addTool, multiplyTool],
    think: true,
  });

  messages.push(response.message);

  if (!response.message.tool_calls?.length) {
    break; // No more tools, task complete
  }

  // Execute tools and add results
  for (const call of response.message.tool_calls) {
    const result = executeTool(call);
    messages.push({ role: 'tool', tool_name: call.function.name, content: result });
  }
}
```

#### 4. Streaming with Tool Calling

Stream responses while detecting and executing tools:

```javascript
const stream = await ollama.chat({
  model: 'qwen3',
  messages,
  tools: [getTemperatureTool],
  stream: true,
  think: true,
});

let thinking = '';
let content = '';
const toolCalls = [];

for await (const chunk of stream) {
  if (chunk.message.thinking) {
    thinking += chunk.message.thinking;
  }
  if (chunk.message.content) {
    content += chunk.message.content;
  }
  if (chunk.message.tool_calls?.length) {
    toolCalls.push(...chunk.message.tool_calls);
  }
}

// Accumulate all fields, then pass back with tool results
messages.push({ role: 'assistant', thinking, content, tool_calls: toolCalls });
```

---

## Tool Schema Format

Ollama uses **OpenAI-compatible tool schema**:

```javascript
{
  type: 'function',
  function: {
    name: 'get_temperature',
    description: 'Get the current temperature for a city',
    parameters: {
      type: 'object',
      required: ['city'],
      properties: {
        city: {
          type: 'string',
          description: 'The name of the city'
        },
        format: {
          type: 'string',
          description: 'Temperature format',
          enum: ['celsius', 'fahrenheit']
        }
      }
    }
  }
}
```

### Python SDK Convenience

Python SDK can automatically parse functions as tool schemas:

```python
def get_temperature(city: str) -> str:
  """Get the current temperature for a city

  Args:
    city: The name of the city

  Returns:
    The current temperature for the city
  """
  temperatures = {'New York': '22°C', 'London': '15°C'}
  return temperatures.get(city, 'Unknown')

# Pass function directly - SDK generates schema from docstring
response = chat(
  model='qwen3',
  messages=messages,
  tools=[get_temperature],  # Function, not schema!
  think=True
)
```

---

## Message Format

### Tool Call Message

```javascript
{
  role: 'assistant',
  thinking: '<think>I need to check the temperature...</think>',
  content: '',
  tool_calls: [
    {
      type: 'function',
      function: {
        index: 0,
        name: 'get_temperature',
        arguments: { city: 'New York' }
      }
    }
  ]
}
```

### Tool Result Message

```javascript
{
  role: 'tool',
  tool_name: 'get_temperature',
  content: '22°C'
}
```

---

## Thinking Mode

Many tool-capable models support **thinking mode** (`think: true`):

```javascript
const response = await ollama.chat({
  model: 'qwen3',
  messages,
  tools,
  think: true, // Enable thinking mode
});

// Response includes thinking field
console.log(response.message.thinking); // "<think>I need to...</think>"
console.log(response.message.content); // "The temperature is 22°C"
```

**Models with Thinking Support:**

- Qwen 3 (full thinking)
- GPT-OSS (think levels: low, medium, high)
- DeepSeek-v3.1 (full thinking)
- DeepSeek R1 (reasoning model)

---

## Streaming Tool Calling (2025+)

### New Parser (May 2025)

Ollama introduced a new incremental parser that:

- **Streams content** while detecting tool calls
- **Understands model templates** to recognize tool prefixes
- **Handles partial output** from models not trained on tool tokens
- **Improves accuracy** by preventing duplicate tool call detection

### Key Improvements

1. **Real-time streaming** - No need to wait for complete generation
2. **Prefix matching** - Correctly identifies tool calls based on model template
3. **Fallback parsing** - Handles models that output JSON without prefix
4. **Duplicate prevention** - Avoids parsing tool references as new calls

### Example Output

```json
{"message": {"role": "assistant", "content": "<think>"}, "done": false}
{"message": {"role": "assistant", "content": "I need to check..."}, "done": false}
{"message": {"role": "assistant", "content": "</think>"}, "done": false}
{"message": {"role": "assistant", "content": "", "tool_calls": [...]}, "done": false}
{"message": {"role": "assistant", "content": ""}, "done": true}
```

---

## Best Practices

### 1. Use Thinking Mode

Enable `think: true` for better reasoning:

```javascript
const response = await ollama.chat({
  model: 'qwen3',
  messages,
  tools,
  think: true, // ✅ Better tool selection
});
```

### 2. Accumulate Streaming Fields

When streaming, accumulate all fields before passing back:

```javascript
let thinking = '';
let content = '';
const toolCalls = [];

for await (const chunk of stream) {
  if (chunk.message.thinking) thinking += chunk.message.thinking;
  if (chunk.message.content) content += chunk.message.content;
  if (chunk.message.tool_calls) toolCalls.push(...chunk.message.tool_calls);
}

// Pass accumulated fields together
messages.push({ role: 'assistant', thinking, content, tool_calls: toolCalls });
```

### 3. Increase Context Window for Complex Tasks

For better tool calling performance:

```javascript
const response = await ollama.chat({
  model: 'qwen3',
  messages,
  tools,
  options: {
    num_ctx: 32000, // ✅ Larger context = better tool performance
  },
});
```

### 4. Handle Tool Execution Errors

Always handle tool failures gracefully:

```javascript
for (const call of response.message.tool_calls) {
  try {
    const result = await executeTool(call);
    messages.push({
      role: 'tool',
      tool_name: call.function.name,
      content: JSON.stringify(result),
    });
  } catch (error) {
    messages.push({
      role: 'tool',
      tool_name: call.function.name,
      content: JSON.stringify({ error: error.message }),
    });
  }
}
```

### 5. Implement Max Iterations

Prevent infinite loops in agent loops:

```javascript
const MAX_ITERATIONS = 20;
let iteration = 0;

while (iteration < MAX_ITERATIONS) {
  iteration++;
  const response = await ollama.chat({ model, messages, tools });

  if (!response.message.tool_calls?.length) {
    break; // Task complete
  }

  // Execute tools...
}

if (iteration >= MAX_ITERATIONS) {
  console.warn('Reached max iterations');
}
```

---

## ForgeAI Implementation Notes

### Current Configuration

Our extension uses:

- **Model:** `gpt-oss:120b-cloud` (cloud model)
- **Tool calling:** ✅ Supported
- **Thinking mode:** ✅ Supported (with levels)
- **Streaming:** ✅ Fully implemented
- **Agent loop:** ✅ With 20 iteration limit

### Verification

✅ **gpt-oss:120b-cloud supports tool calling**  
✅ **Cloud models work with same API**  
✅ **Streaming with tools is supported**  
✅ **Thinking mode is available**

### Alternative Models

If we need to switch models, these are verified to work:

**Cloud Models:**

- `qwen3-coder:480b-cloud` - Best for coding
- `gpt-oss:120b-cloud` - Current choice
- `deepseek-v3.1:671b-cloud` - Advanced reasoning

**Local Models:**

- `qwen3` - Excellent tool support
- `llama3.1:70b` - Strong general purpose
- `qwen2.5-coder` - Good for coding

---

## References

- [Ollama Tool Calling Docs](https://docs.ollama.com/capabilities/tool-calling)
- [Cloud Models Blog](https://ollama.com/blog/cloud-models)
- [Streaming Tool Calling Blog](https://ollama.com/blog/streaming-tool)
- [Tool Support Blog](https://ollama.com/blog/tool-support)
- [Thinking Mode Docs](https://docs.ollama.com/capabilities/thinking)
- [Tool Models Search](https://ollama.com/search?c=tools)

---

## Conclusion

**Ollama's tool calling and cloud models are production-ready for ForgeAI:**

1. ✅ **Cloud models available** - Run large models without local hardware
2. ✅ **Tool calling supported** - Multiple patterns (single-shot, parallel, agent loop)
3. ✅ **Streaming works** - Real-time responses with tool detection
4. ✅ **Thinking mode** - Better reasoning and decision-making
5. ✅ **Privacy preserved** - Cloud doesn't retain data
6. ✅ **Same API** - Seamless local/cloud switching

Our current implementation with `gpt-oss:120b-cloud` is well-supported and follows best practices.
