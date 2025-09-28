#!/usr/bin/env node

/**
 * Node.js test script using the same LangGraph SDK version as the frontend
 *
 * This script uses @langchain/langgraph-sdk@0.0.105 (same as frontend) to ensure
 * we see the exact same streaming events that the frontend receives.
 */

const { Client } = require('@langchain/langgraph-sdk');
const fs = require('fs');
require('dotenv').config();

// Sample lesson context data (matching the Python script)
const sessionContext = {
  session_id: "test-connection-session-js-001",
  student_id: "test-student-js-456",
  lesson_snapshot: {
    courseId: "math-basics-101",
    lessonTemplateId: "fractions-intro-template",
    title: "Introduction to Fractions",
    topic: "Mathematics - Basic Fractions",
    description: "Learn about numerators, denominators, and basic fraction operations",
    objectives: [
      "Understand what numerators and denominators represent",
      "Compare simple fractions",
      "Recognize equivalent fractions",
      "Simplify basic fractions"
    ],
    cards: [
      {
        id: "fraction-basics-1",
        title: "Understanding Fractions",
        explainer: "A fraction shows parts of a whole. The number on top is the numerator (parts we have), and the number on bottom is the denominator (total parts).",
        content: "Let's explore what 2/10 means and how we can simplify it.",
        cfu: {
          id: "cfu-simplify-1",
          type: "text",
          question: "What is 2/10 simplified to its lowest terms?",
          expected: "1/5",
          hints: ["Find the greatest common divisor", "Both 2 and 10 can be divided by 2"]
        }
      },
      {
        id: "fraction-comparison-2",
        title: "Comparing Fractions",
        explainer: "To compare fractions, we can convert them to have the same denominator or convert them to decimals.",
        content: "Let's compare 3/4 and 2/3 to see which is larger.",
        cfu: {
          id: "cfu-compare-1",
          type: "mcq",
          question: "Which fraction is larger: 3/4 or 2/3?",
          options: ["3/4", "2/3", "They are equal"],
          correct: 0,
          explanation: "3/4 = 0.75 and 2/3 ≈ 0.67, so 3/4 is larger"
        }
      }
    ]
  }
};

async function testLangGraphConnection() {
  console.log('🚀 Node.js LangGraph Connection Test (Frontend SDK Compatible)');
  console.log('='.repeat(70));

  // Setup LangSmith tracing
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const langsmithProject = `langgraph-js-test-${timestamp}`;

  if (process.env.LANGSMITH_API_KEY) {
    process.env.LANGSMITH_PROJECT = langsmithProject;
    console.log('📊 LangSmith tracing enabled');
    console.log(`   - Project: ${langsmithProject}`);
    console.log(`   - API Key: ${process.env.LANGSMITH_API_KEY.slice(0, 20)}...`);
  } else {
    console.log('⚠️  LangSmith API key not found - traces won\'t be recorded');
  }

  try {
    // Create client using the same configuration as the frontend
    const client = new Client({
      apiUrl: "http://localhost:2024"
    });
    const assistantId = "agent";

    console.log('✅ Connected to LangGraph server at http://localhost:2024');
    console.log(`📝 Using assistant ID: ${assistantId}`);

    // Create thread
    const thread = await client.threads.create();
    const threadId = thread.thread_id;
    console.log(`🔗 Created thread: ${threadId}`);

    console.log('📚 Created lesson context:');
    console.log(`   - Course: ${sessionContext.lesson_snapshot.title}`);
    console.log(`   - Cards: ${sessionContext.lesson_snapshot.cards.length}`);
    console.log(`   - Session ID: ${sessionContext.session_id}`);

    // Prepare input (same as frontend)
    const input = {
      messages: [{
        type: "human",
        content: "" // Empty message like AutoStartTrigger
      }],
      session_context: sessionContext
    };

    console.log('\n🎯 Sending lesson start request...');
    console.log('   - Message content: "" (empty, like AutoStartTrigger)');
    console.log('   - Session context: included');

    // Stream using the same configuration as frontend
    const streamConfig = {
      input,
      streamMode: ["messages", "updates"], // Same as frontend
      streamSubgraphs: true
    };

    console.log('\n📡 Streaming response from LangGraph:');
    console.log('-'.repeat(50));

    // Track events and tool calls
    let responseCount = 0;
    let messagesCount = 0;
    let toolCallsSeen = [];
    let hitInterrupt = false;
    let eventTypes = new Set();
    let lastToolCall = null; // Store tool call for response simulation

    const stream = client.runs.stream(threadId, assistantId, streamConfig);

    for await (const chunk of stream) {
      responseCount++;
      eventTypes.add(chunk.event);

      // Log different event types with more detail
      if (chunk.event === "messages" && chunk.data) {
        messagesCount++;
        for (const msg of chunk.data) {
          if (msg.content && msg.content.trim()) {
            console.log(`💬 AI Message: ${msg.content.slice(0, 100)}...`);
          }

          // Check for tool calls
          if (msg.tool_calls && msg.tool_calls.length > 0) {
            for (const toolCall of msg.tool_calls) {
              toolCallsSeen.push(toolCall.name);
              console.log(`🔧 Tool Call: ${toolCall.name}`);
              if (toolCall.args) {
                console.log(`   - Args keys: ${Object.keys(toolCall.args)}`);
                if (toolCall.name === "lesson_card_presentation" && toolCall.args.card_data) {
                  console.log(`   - Card title: ${toolCall.args.card_data.title || 'N/A'}`);
                }
              }
            }
          }
        }
      }

      else if (chunk.event === "messages/metadata" && chunk.data) {
        console.log('📋 Messages metadata received');
      }

      else if (chunk.event === "messages/partial" && chunk.data) {
        // More detailed parsing of partial messages
        let hasToolCall = false;
        for (const msg of chunk.data) {
          // Check different possible structures for tool calls
          if (msg.tool_calls && msg.tool_calls.length > 0) {
            hasToolCall = true;
            for (const toolCall of msg.tool_calls) {
              if (!toolCallsSeen.includes(toolCall.name)) {
                toolCallsSeen.push(toolCall.name);
                console.log(`🔧 Tool Call (partial): ${toolCall.name}`);
                if (toolCall.args) {
                  console.log(`   - Args keys: ${Object.keys(toolCall.args)}`);
                }
              }
            }
          }
          // Also check if message content mentions tool calls
          if (msg.content && typeof msg.content === 'string' && msg.content.includes('lesson_card_presentation')) {
            console.log(`🔍 Partial message mentions lesson_card_presentation`);
          }
        }

        if (hasToolCall) {
          console.log('📝 Partial message chunk with tool calls');
        } else {
          // Only log if we haven't seen many partials yet (first 5)
          const partialCount = Array.from(eventTypes).filter(t => t === "messages/partial").length;
          if (partialCount <= 5) {
            console.log('📝 Partial message chunk received');
          }
        }
      }

      else if (chunk.event === "updates") {
        console.log('🔄 Update event');
      }

      else if (chunk.event === "messages/complete" && chunk.data) {
        console.log('✅ Complete message received');
        // Check final messages for tool calls
        for (const msg of chunk.data) {
          if (msg.tool_calls && msg.tool_calls.length > 0) {
            for (const toolCall of msg.tool_calls) {
              if (!toolCallsSeen.includes(toolCall.name)) {
                toolCallsSeen.push(toolCall.name);
                console.log(`🔧 Tool Call (complete): ${toolCall.name}`);
                if (toolCall.args) {
                  console.log(`   - Args keys: ${Object.keys(toolCall.args)}`);
                  if (toolCall.name === "lesson_card_presentation" && toolCall.args.card_data) {
                    console.log(`   - Card title: ${toolCall.args.card_data.title || 'N/A'}`);
                    console.log(`   - Question: ${toolCall.args.card_data.cfu?.question || 'N/A'}`);
                    console.log(`   - CFU Type: ${toolCall.args.cfu_type || 'N/A'}`);

                    // Store the tool call for later response simulation
                    lastToolCall = toolCall;
                  }
                }
              }
            }
          }
          if (msg.content && msg.content.trim()) {
            console.log(`   - Content: ${msg.content.slice(0, 100)}...`);
          }
        }
      }

      else if (chunk.event === "interrupt") {
        hitInterrupt = true;
        console.log('⏸️  Interrupt detected - graph waiting for user response');
      }

      else {
        // Log unknown events with more detail for debugging
        if (chunk.event && chunk.event.trim()) {
          console.log(`❓ Unknown event: "${chunk.event}"`);
        }
      }
    }

    console.log('-'.repeat(50));
    console.log(`📊 Event types seen: ${Array.from(eventTypes).join(', ')}`);
    console.log(`📊 Messages received: ${messagesCount}`);
    console.log(`⏸️  Hit interrupt: ${hitInterrupt}`);
    console.log(`📊 Stream complete - received ${responseCount} chunks`);

    // Get final state
    // const finalState = (await client.threads.getState(threadId, {subgraphs: true}));
    const finalState = (await client.threads.getState(threadId));
    console.log('RAW STATE TASK:\n');
    console.log(finalState.values);
    console.log('\n📋 Session Summary:');
    console.log(`   - Thread ID: ${threadId}`);
    console.log(`   - Tool calls seen: ${toolCallsSeen}`);
    console.log(`   - Response chunks: ${responseCount}`);

    if (finalState.values) {
      console.log(`   - Final mode: ${finalState.values.mode || 'unknown'}`);
      console.log(`   - Messages in state: ${finalState.values.messages?.length || 0}`);
    }

    if (finalState.interrupts && finalState.interrupts.length > 0) {
      console.log(`   - Interrupts: ${finalState.interrupts.length} (for UI interaction)`);
    }

    // Simulate student response if we got a lesson card tool call
    if (lastToolCall && lastToolCall.name === "lesson_card_presentation") {
      console.log('\n🎓 Simulating Student Response (like LessonCardPresentationTool.tsx):');
      console.log('='.repeat(60));

      const cardData = lastToolCall.args.card_data;
      const cfuType = lastToolCall.args.cfu_type;

      // Generate a simulated student answer based on question type
      let studentAnswer;
      if (cfuType === "mcq" && cardData.cfu.options) {
        // For MCQ, pick the first option (or correct answer if available)
        studentAnswer = cardData.cfu.options[cardData.cfu.correct || 0];
        console.log(`📝 MCQ Question: ${cardData.cfu.question}`);
        console.log(`📝 Student selected: ${studentAnswer}`);
      } else {
        // For text questions, use expected answer or a reasonable response
        studentAnswer = cardData.cfu.expected || "1/5";
        console.log(`📝 Text Question: ${cardData.cfu.question}`);
        console.log(`📝 Student answered: ${studentAnswer}`);
      }

      // Create the command payload (matching LessonCardPresentationTool.tsx)
      const commandPayload = {
        resume: JSON.stringify({
          action: "submit_answer",
          student_response: studentAnswer,
          interaction_type: "answer_submission",
          card_id: cardData.id,
          interaction_id: lastToolCall.args.interaction_id,
          timestamp: new Date().toISOString()
        })
      };

      console.log(`🚀 Sending student answer back to graph...`);
      console.log(`   - Action: submit_answer`);
      console.log(`   - Answer: ${studentAnswer}`);
      console.log(`   - Card ID: ${cardData.id}`);

      try {
        // Send the command back to continue the graph execution
        const responseStream = client.runs.stream(threadId, assistantId, {
          command: commandPayload,
          streamMode: ["messages", "updates"],
          streamSubgraphs: true
        });

        console.log('\n📡 Streaming graph response after student answer:');
        console.log('-'.repeat(50));

        let responseCount2 = 0;
        let toolCallsSeen2 = [];
        let latestToolCall = null;

        for await (const chunk of responseStream) {
          responseCount2++;

          if (chunk.event === "messages/complete" && chunk.data) {
            console.log('✅ Response message received');
            for (const msg of chunk.data) {
              if (msg.tool_calls && msg.tool_calls.length > 0) {
                for (const toolCall of msg.tool_calls) {
                  toolCallsSeen2.push(toolCall.name);
                  console.log(`🔧 Response Tool Call: ${toolCall.name}`);
                  // Capture the latest lesson_card_presentation tool call
                  if (toolCall.name === 'lesson_card_presentation') {
                    latestToolCall = toolCall;
                    console.log(`   📝 Captured card: ${toolCall.args?.card_data?.title || 'N/A'}`);
                  }
                }
              }
              if (msg.content && msg.content.trim()) {
                console.log(`💬 Response Content: ${msg.content.slice(0, 200)}...`);
              }
            }
          } else if (chunk.event === "updates") {
            console.log('🔄 Response update event');
          }
        }

        console.log('-'.repeat(50));
        console.log(`📊 Response stream completed: ${responseCount2} chunks`);
        console.log(`📊 New tool calls: ${toolCallsSeen2}`);

        // Get final state after student response
        // const finalState2 = await client.threads.getState(threadId, {subgraphs: true});
        const finalState2 = await client.threads.getState(threadId);


        console.log('RAW STATE TASK:\n');
        console.log(finalState2.values);
        console.log(`📊 Final state after answer: ${finalState2.values?.messages?.length || 0} messages`);

        // Print detailed graph state after student response
        console.log('\n🔍 DETAILED GRAPH STATE AFTER STUDENT RESPONSE:');
        console.log('='.repeat(60));

        if (finalState2) {
          console.log(`📌 Thread ID: ${threadId}`);
          console.log(`📌 State Keys: ${Object.keys(finalState2)}`);

          // Print values (main state data)
          if (finalState2.values) {
            const values = finalState2.values;
            console.log(`\n📊 State Values After Student Response:`);

            for (const [key, value] of Object.entries(values)) {
              if (key === 'messages') {
                console.log(`   - ${key}: ${value.length} messages`);
                // Show last 3 messages
                for (let i = Math.max(0, value.length - 3); i < value.length; i++) {
                  const msg = value[i];
                  const msgType = msg.type || 'unknown';
                  let content = '';
                  if (msg.content && typeof msg.content === 'string') {
                    content = msg.content.length > 100 ? msg.content.slice(0, 100) + '...' : msg.content;
                  }
                  console.log(`     [${i}] ${msgType}: ${content}`);

                  // Show tool calls if present
                  if (msg.tool_calls && msg.tool_calls.length > 0) {
                    for (const tc of msg.tool_calls) {
                      console.log(`         🔧 Tool: ${tc.name}`);
                      if (tc.args && tc.name === 'lesson_card_presentation') {
                        console.log(`            - Card: ${tc.args.card_data?.title || 'N/A'}`);
                        console.log(`            - Question: ${tc.args.card_data?.cfu?.question || 'N/A'}`);
                      }
                    }
                  }
                }
              } else if (Array.isArray(value)) {
                console.log(`   - ${key}: [${value.length} items] ${JSON.stringify(value.slice(0, 2))}${value.length > 2 ? '...' : ''}`);
              } else if (typeof value === 'object' && value !== null) {
                const keys = Object.keys(value);
                if (keys.length <= 3) {
                  console.log(`   - ${key}: ${JSON.stringify(value)}`);
                } else {
                  const preview = {};
                  keys.slice(0, 3).forEach(k => preview[k] = value[k]);
                  console.log(`   - ${key}: ${JSON.stringify(preview)}... (${keys.length} keys total)`);
                }
              } else {
                console.log(`   - ${key}: ${value}`);
              }
            }

            // Special attention to teaching-related fields
            if (values.current_stage) {
              console.log(`\n🎓 Teaching State:`);
              console.log(`   - Stage: ${values.current_stage}`);
              console.log(`   - Card Index: ${values.current_card_index || 0}`);
              console.log(`   - Attempts: ${values.attempts || 0}`);
              console.log(`   - Is Correct: ${values.is_correct}`);
              console.log(`   - Should Progress: ${values.should_progress}`);
              if (values.cards_completed) {
                console.log(`   - Cards Completed: ${values.cards_completed.length}`);
              }
            }
          }

          // Print next steps
          if (finalState2.next) {
            console.log(`\n🎯 Next Steps: ${JSON.stringify(finalState2.next)}`);
          }

          // Print interrupts (detailed)
          if (finalState2.interrupts && finalState2.interrupts.length > 0) {
            console.log(`\n⏸️  INTERRUPTS (${finalState2.interrupts.length}):`);
            finalState2.interrupts.forEach((interrupt, i) => {
              console.log(`   [${i}] ${JSON.stringify(interrupt, null, 2)}`);
            });
          } else {
            console.log(`\n✅ No interrupts - execution completed`);
          }

          // Print checkpoint metadata
          if (finalState2.metadata) {
            console.log(`\n📝 Checkpoint Metadata:`);
            for (const [key, value] of Object.entries(finalState2.metadata)) {
              console.log(`   - ${key}: ${value}`);
            }
          }
        } else {
          console.log("❌ No final state received from thread");
        }

        // Get and print thread history
        console.log('\n📚 THREAD HISTORY:');
        console.log('='.repeat(60));

        try {
          const history = await client.threads.getHistory(threadId);
          console.log(`📊 History contains ${history.length} checkpoints`);

          // Show last 5 checkpoints with details
          const recentHistory = history.slice(-5);
          recentHistory.forEach((checkpoint, i) => {
            const index = history.length - recentHistory.length + i;
            console.log(`\n[${index}] Checkpoint ID: ${checkpoint.checkpoint_id || 'N/A'}`);
            console.log(`    - Parent: ${checkpoint.parent_checkpoint_id || 'N/A'}`);
            console.log(`    - Created: ${new Date(checkpoint.created_at || Date.now()).toISOString()}`);

            if (checkpoint.metadata) {
              console.log(`    - Metadata: ${JSON.stringify(checkpoint.metadata)}`);
            }

            if (checkpoint.values) {
              const values = checkpoint.values;
              console.log(`    - Messages: ${values.messages?.length || 0}`);
              console.log(`    - Mode: ${values.mode || 'unknown'}`);

              if (values.current_stage) {
                console.log(`    - Teaching Stage: ${values.current_stage}`);
                console.log(`    - Card Index: ${values.current_card_index || 0}`);
              }

              // Show any state changes
              if (i > 0) {
                const prevValues = recentHistory[i-1].values;
                if (prevValues && prevValues.current_card_index !== values.current_card_index) {
                  console.log(`    - 🔄 Card Index Changed: ${prevValues.current_card_index} → ${values.current_card_index}`);
                }
                if (prevValues && prevValues.current_stage !== values.current_stage) {
                  console.log(`    - 🔄 Stage Changed: ${prevValues.current_stage} → ${values.current_stage}`);
                }
              }
            }

            if (checkpoint.next && checkpoint.next.length > 0) {
              console.log(`    - Next: ${JSON.stringify(checkpoint.next)}`);
            }

            if (checkpoint.interrupts && checkpoint.interrupts.length > 0) {
              console.log(`    - Interrupts: ${checkpoint.interrupts.length}`);
            }
          });

        } catch (historyError) {
          console.error('❌ Error retrieving thread history:', historyError.message);
        }

        console.log('='.repeat(60));

        // Check for next tool call (second lesson card)
        if (toolCallsSeen2.includes('lesson_card_presentation')) {
          console.log('\n🎓 SECOND LESSON CARD DETECTED - Continuing lesson...');
          console.log('============================================================');

          // Use the captured tool call from the stream first, then fallback to state search
          let nextToolCall = latestToolCall;

          // Get the most recent state to find the new tool call if not captured during stream
          if (!nextToolCall) {
            // const currentState = await client.threads.getState(threadId, {subgraphs: true});
            const currentState = await client.threads.getState(threadId);
            console.log('RAW STATE TASK:\n');
            console.log(currentState.values);

            // Find the latest lesson_card_presentation tool call in messages
            if (currentState.values && currentState.values.messages) {
              const messages = currentState.values.messages;
              for (let i = messages.length - 1; i >= 0; i--) {
                const msg = messages[i];
                if (msg.tool_calls && msg.tool_calls.length > 0) {
                  for (const tc of msg.tool_calls) {
                    if (tc.name === 'lesson_card_presentation') {
                      nextToolCall = tc;
                      break;
                    }
                  }
                  if (nextToolCall) break;
                }
              }
            }

            // Also check in interrupts for tool calls
            if (!nextToolCall && currentState.interrupts && currentState.interrupts.length > 0) {
              for (const interrupt of currentState.interrupts) {
                if (interrupt.value && interrupt.value.tool_calls) {
                  for (const tc of interrupt.value.tool_calls) {
                    if (tc.name === 'lesson_card_presentation') {
                      nextToolCall = tc;
                      break;
                    }
                  }
                  if (nextToolCall) break;
                }
              }
            }

            // Debug: Print current state structure to understand where tool calls are stored
            console.log('🔍 DEBUG: Looking for tool calls...');
            console.log(`   - Messages count: ${currentState.values?.messages?.length || 0}`);
            console.log(`   - Interrupts count: ${currentState.interrupts?.length || 0}`);

            if (currentState.values?.messages) {
              currentState.values.messages.forEach((msg, i) => {
                if (msg.tool_calls && msg.tool_calls.length > 0) {
                  console.log(`   - Message ${i} has ${msg.tool_calls.length} tool calls: ${msg.tool_calls.map(tc => tc.name).join(', ')}`);
                }
              });
            }
          }

          if (nextToolCall && nextToolCall.args && nextToolCall.args.card_data) {
            const cardData2 = nextToolCall.args.card_data;
            console.log(`📋 Second Card: ${cardData2.title}`);
            console.log(`📋 Question: ${cardData2.cfu?.question || 'N/A'}`);
            console.log(`📋 Type: ${cardData2.cfu?.type || 'text'}`);

            // Determine appropriate answer for the second card
            let studentAnswer2;
            if (cardData2.cfu?.type === 'mcq') {
              // For MCQ, select the correct answer
              const correctIndex = cardData2.cfu.correct || 0;
              studentAnswer2 = cardData2.cfu.options?.[correctIndex] || cardData2.cfu.options?.[0] || "3/4";
              console.log(`📝 MCQ Question: ${cardData2.cfu.question}`);
              console.log(`📝 Student selected: ${studentAnswer2}`);
            } else {
              // For text questions, use expected or reasonable answer
              studentAnswer2 = cardData2.cfu?.expected || "3/4";
              console.log(`📝 Text Question: ${cardData2.cfu.question}`);
              console.log(`📝 Student answered: ${studentAnswer2}`);
            }

            // Create command payload for second answer
            const commandPayload2 = {
              resume: JSON.stringify({
                action: "submit_answer",
                student_response: studentAnswer2,
                interaction_type: "answer_submission",
                card_id: cardData2.id,
                interaction_id: nextToolCall.args.interaction_id,
                timestamp: new Date().toISOString()
              })
            };

            console.log(`🚀 Sending second answer back to graph...`);
            console.log(`   - Action: submit_answer`);
            console.log(`   - Answer: ${studentAnswer2}`);
            console.log(`   - Card ID: ${cardData2.id}`);

            try {
              // Send the second answer
              const responseStream3 = client.runs.stream(threadId, assistantId, {
                command: commandPayload2,
                streamMode: ["messages", "updates"],
                streamSubgraphs: true
              });

              console.log('\n📡 Streaming graph response after second answer:');
              console.log('-'.repeat(50));

              let responseCount3 = 0;
              let toolCallsSeen3 = [];

              for await (const chunk of responseStream3) {
                responseCount3++;

                if (chunk.event === "messages/complete" && chunk.data) {
                  console.log('✅ Final response message received');
                  for (const msg of chunk.data) {
                    if (msg.tool_calls && msg.tool_calls.length > 0) {
                      for (const toolCall of msg.tool_calls) {
                        toolCallsSeen3.push(toolCall.name);
                        console.log(`🔧 Final Tool Call: ${toolCall.name}`);
                      }
                    }
                    if (msg.content && msg.content.trim()) {
                      console.log(`💬 Final Content: ${msg.content.slice(0, 200)}...`);
                    }
                  }
                } else if (chunk.event === "updates") {
                  console.log('🔄 Final update event');
                }
              }

              console.log('-'.repeat(50));
              console.log(`📊 Final stream completed: ${responseCount3} chunks`);
              console.log(`📊 Final tool calls: ${toolCallsSeen3}`);

              // Get final lesson state
              // const finalLessonState = await client.threads.getState(threadId, {subgraphs: true});
              const finalLessonState = await client.threads.getState(threadId);
              console.log('RAW STATE TASK:\n');
              console.log(finalLessonState.values);
              console.log(`📊 Lesson completed - messages: ${finalLessonState.values?.messages?.length || 0}`);

              if (finalLessonState.values) {
                const lessonValues = finalLessonState.values;
                console.log('\n🎓 FINAL LESSON STATE:');
                console.log(`   - Cards Completed: ${lessonValues.cards_completed?.length || 0}`);
                console.log(`   - Current Card Index: ${lessonValues.current_card_index || 0}`);
                console.log(`   - Attempts: ${lessonValues.attempts || 0}`);
                console.log(`   - Should Exit: ${lessonValues.should_exit || false}`);
                console.log(`   - Interrupts: ${finalLessonState.interrupts?.length || 0}`);

                if (lessonValues.cards_completed && lessonValues.cards_completed.length > 0) {
                  console.log(`   - Completed Card IDs: ${JSON.stringify(lessonValues.cards_completed)}`);
                }
              }

            } catch (secondResponseError) {
              console.error('❌ Error sending second answer:', secondResponseError.message);
            }
          } else {
            console.log('❌ Could not find second lesson card tool call');
          }

          console.log('='.repeat(60));
        } else {
          console.log('\n✅ No additional tool calls detected - lesson may be complete');
        }

      } catch (responseError) {
        console.error('❌ Error sending student response:', responseError.message);
      }

      console.log('='.repeat(60));
    }

    console.log('\n✅ Node.js LangGraph connection test successful!');

    // Save results
    const resultData = {
      thread_id: threadId,
      session_context: sessionContext,
      tool_calls_seen: toolCallsSeen,
      response_count: responseCount,
      messages_count: messagesCount,
      hit_interrupt: hitInterrupt,
      event_types_seen: Array.from(eventTypes),
      final_state_keys: Object.keys(finalState),
      langsmith_project: langsmithProject,
      langsmith_enabled: !!process.env.LANGSMITH_API_KEY,
      test_timestamp: new Date().toISOString(),
      sdk_version: "frontend-compatible-js",
      simulated_student_response: !!lastToolCall,
      last_tool_call_name: lastToolCall?.name || null
    };

    fs.writeFileSync('langgraph_connection_test_results_js.json', JSON.stringify(resultData, null, 2));
    console.log('💾 Test results saved to: langgraph_connection_test_results_js.json');

    if (process.env.LANGSMITH_API_KEY) {
      console.log(`🔗 View traces at: https://smith.langchain.com/o/scottish-ai-lessons/projects/p/${langsmithProject}`);
    }

    return true;

  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

async function main() {
  console.log('LangGraph Node.js SDK Connection Test (Frontend Compatible)');
  console.log('This script uses the same @langchain/langgraph-sdk version as the frontend\n');

  const success = await testLangGraphConnection();

  if (success) {
    console.log('\n🎉 Test completed successfully!');
    console.log('\nWhat happened:');
    console.log('1. ✅ Connected using frontend-compatible SDK (@langchain/langgraph-sdk@0.0.105)');
    console.log('2. ✅ Created new thread for lesson session');
    console.log('3. ✅ Sent lesson context (same structure as frontend)');
    console.log('4. ✅ Triggered teaching with empty message (like AutoStartTrigger)');
    console.log('5. ✅ Streamed response with proper event handling');
    console.log('6. ✅ Captured tool calls and messages like the frontend does');

    console.log('\nNext steps:');
    console.log('- Check langgraph_connection_test_results_js.json for details');
    console.log('- Compare with Python script results to see differences');
    console.log('- Tool calls should now be visible in streaming events');

    process.exit(0);
  } else {
    console.log('\n💥 Test failed - check error output above');
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);