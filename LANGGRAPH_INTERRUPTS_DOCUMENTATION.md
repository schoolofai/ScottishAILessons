# LangGraph Interrupts with Assistant-UI: Complete Implementation Guide

This document provides comprehensive guidance on implementing human-in-the-loop workflows using LangGraph's interrupt system with assistant-ui frontend components.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Architecture Overview](#architecture-overview)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Integration](#frontend-integration)
5. [Complete Working Examples](#complete-working-examples)
6. [Advanced Patterns](#advanced-patterns)
7. [Best Practices](#best-practices)
8. [Integration with ScottishAILessons](#integration-with-scottishailessons)

## Core Concepts

### What are LangGraph Interrupts?

LangGraph interrupts are a mechanism to pause graph execution at specific points, allowing for human intervention before the workflow continues. This enables:

- **Human approval workflows** - Get user confirmation before executing critical actions
- **Data collection** - Pause to collect additional input from users
- **Review and editing** - Allow humans to review and modify AI-generated content
- **Multi-step interactions** - Create complex conversational flows

### Key Components

1. **`interrupt()` function** - Pauses execution and surfaces data to the UI
2. **Checkpointers** - Persist graph state across interruptions
3. **`Command(resume=...)` - Resumes execution with human-provided input
4. **Tool UIs** - Frontend components that handle interrupt interactions

### The Interrupt-Resume Cycle

```
1. Graph executes normally
2. Node calls interrupt() with payload
3. Execution pauses, state is saved
4. UI receives interrupt payload
5. User interacts with UI component
6. UI calls callTool() with response
7. Graph resumes with user input
8. Execution continues
```

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   LangGraph     │    │   Assistant-UI  │    │      User       │
│    Backend      │    │    Frontend     │    │   Interface     │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • interrupt()   │◄──►│ • Tool UIs      │◄──►│ • Approval      │
│ • Checkpointer  │    │ • Event Stream  │    │   Buttons       │
│ • State Mgmt    │    │ • Thread Mgmt   │    │ • Form Inputs   │
│ • Resume Logic  │    │ • callTool()    │    │ • Validation    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Backend Implementation

### Basic Interrupt Setup

```python
from typing import TypedDict, Optional
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.graph import StateGraph
from langgraph.graph.message import add_messages
from langgraph.types import interrupt, Command
from langgraph.checkpoint.sqlite import SqliteSaver
from typing_extensions import Annotated

class State(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    pending_approval: Optional[dict]
    approved: Optional[bool]

def approval_node(state: State) -> dict:
    """Node that requires human approval before proceeding."""
    if state.get("approved") is None:
        # Interrupt with approval request
        decision = interrupt({
            "tool": "confirm_purchase",  # Tool UI identifier
            "args": state["pending_approval"],
            "question": "Do you approve this purchase?"
        })
        return {"approved": bool(decision.get("approve", False))}
    
    # We have a decision now
    if state["approved"]:
        return {"messages": [AIMessage("✅ Purchase approved and executed.")]}
    else:
        return {"messages": [AIMessage("❌ Purchase cancelled.")]}

# Build graph with checkpointer (required for interrupts)
def build_graph():
    checkpointer = SqliteSaver.from_conn_string("checkpoints.sqlite")
    
    builder = StateGraph(State)
    builder.add_node("approval", approval_node)
    builder.set_entry_point("approval")
    
    return builder.compile(checkpointer=checkpointer)

# Usage
graph = build_graph()
config = {"configurable": {"thread_id": "user-session-1"}}

# Run until interrupt
result = graph.invoke({
    "messages": [HumanMessage("I want to buy AAPL stock")],
    "pending_approval": {"symbol": "AAPL", "quantity": 100}
}, config=config)

print(result["__interrupt__"])  # Contains interrupt payload

# Resume after user decision
final_result = graph.invoke(
    Command(resume={"approve": True}), 
    config=config
)
```

### Advanced Purchase Approval Example

```python
from typing import Literal
import uuid

class PurchaseState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    purchase_request: Optional[dict]
    approval_status: Optional[str]
    execution_result: Optional[dict]

def analyze_request(state: PurchaseState) -> dict:
    """Analyze the purchase request and prepare for approval."""
    # Extract purchase details from user message
    # In real implementation, use LLM to extract structured data
    return {
        "purchase_request": {
            "symbol": "AAPL",
            "quantity": 100,
            "max_price": 150.0,
            "estimated_cost": 15000.0,
            "risk_level": "medium"
        },
        "messages": [AIMessage("Analyzing purchase request...")]
    }

def human_approval(state: PurchaseState) -> Command[Literal["execute", "cancel"]]:
    """Human approval gate with rich approval UI."""
    approval_data = interrupt({
        "tool": "purchase_approval",
        "args": {
            "request": state["purchase_request"],
            "risk_assessment": {
                "market_volatility": "medium",
                "recommendation": "Consider current market conditions"
            }
        },
        "config": {
            "allow_edit": True,  # Allow user to modify parameters
            "require_reason": True  # Require reason for rejection
        }
    })
    
    if approval_data["action"] == "approve":
        return Command(
            goto="execute",
            update={"approval_status": "approved"}
        )
    elif approval_data["action"] == "edit":
        # User modified the request
        return Command(
            goto="execute", 
            update={
                "approval_status": "approved",
                "purchase_request": approval_data["modified_request"]
            }
        )
    else:
        return Command(
            goto="cancel",
            update={
                "approval_status": "rejected",
                "rejection_reason": approval_data.get("reason")
            }
        )

def execute_purchase(state: PurchaseState) -> dict:
    """Execute the approved purchase."""
    request = state["purchase_request"]
    # Simulate purchase execution
    result = {
        "transaction_id": f"TXN-{uuid.uuid4().hex[:8]}",
        "executed_price": request["max_price"] * 0.98,  # Slightly better price
        "total_cost": request["quantity"] * request["max_price"] * 0.98,
        "timestamp": "2024-01-15T10:30:00Z"
    }
    
    return {
        "execution_result": result,
        "messages": [AIMessage(
            f"✅ Purchase executed successfully!\n"
            f"Transaction ID: {result['transaction_id']}\n"
            f"Bought {request['quantity']} shares of {request['symbol']} "
            f"at ${result['executed_price']:.2f} per share\n"
            f"Total cost: ${result['total_cost']:.2f}"
        )]
    }

def cancel_purchase(state: PurchaseState) -> dict:
    """Cancel the purchase request."""
    reason = state.get("rejection_reason", "User cancelled")
    return {
        "messages": [AIMessage(f"❌ Purchase cancelled. Reason: {reason}")]
    }

# Build the complete purchase workflow
def build_purchase_workflow():
    checkpointer = SqliteSaver.from_conn_string("purchase_checkpoints.sqlite")
    
    builder = StateGraph(PurchaseState)
    builder.add_node("analyze", analyze_request)
    builder.add_node("approval", human_approval)
    builder.add_node("execute", execute_purchase)
    builder.add_node("cancel", cancel_purchase)
    
    builder.set_entry_point("analyze")
    builder.add_edge("analyze", "approval")
    builder.add_edge("execute", "__end__")
    builder.add_edge("cancel", "__end__")
    
    return builder.compile(checkpointer=checkpointer)
```

### Multi-Step Form Example

```python
class FormState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    form_data: dict
    current_step: int
    form_complete: bool

def collect_user_info(state: FormState) -> dict:
    """Multi-step form collection with validation."""
    current_step = state.get("current_step", 1)
    form_data = state.get("form_data", {})
    
    if current_step == 1:
        # Collect basic info
        result = interrupt({
            "tool": "user_info_form",
            "step": 1,
            "fields": ["name", "email", "phone"],
            "title": "Personal Information",
            "data": form_data
        })
        
        # Validate required fields
        if not all(field in result for field in ["name", "email"]):
            return {
                "messages": [AIMessage("Please fill in all required fields.")],
                "current_step": 1
            }
        
        form_data.update(result)
        return {"form_data": form_data, "current_step": 2}
    
    elif current_step == 2:
        # Collect preferences
        result = interrupt({
            "tool": "preferences_form",
            "step": 2,
            "fields": ["investment_experience", "risk_tolerance", "goals"],
            "title": "Investment Preferences",
            "data": form_data
        })
        
        form_data.update(result)
        return {"form_data": form_data, "current_step": 3}
    
    elif current_step == 3:
        # Final review
        result = interrupt({
            "tool": "review_form",
            "step": 3,
            "title": "Review Your Information",
            "data": form_data,
            "editable": True
        })
        
        if result["action"] == "submit":
            return {
                "form_data": result.get("final_data", form_data),
                "form_complete": True,
                "messages": [AIMessage("✅ Information submitted successfully!")]
            }
        else:
            # User wants to edit, go back to specified step
            return {"current_step": result["go_to_step"]}
```

## Frontend Integration

### Tool UI Components with Assistant-UI

```typescript
// Basic Approval Tool UI
import { makeAssistantToolUI } from "@assistant-ui/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PurchaseApprovalArgs = {
  request: {
    symbol: string;
    quantity: number;
    max_price: number;
    estimated_cost: number;
    risk_level: string;
  };
  risk_assessment: {
    market_volatility: string;
    recommendation: string;
  };
};

export const PurchaseApprovalTool = makeAssistantToolUI<PurchaseApprovalArgs, any>({
  toolName: "purchase_approval",
  render: function PurchaseApprovalUI({ args, callTool, status }) {
    const { request, risk_assessment } = args;
    
    const handleApprove = () => {
      callTool({ action: "approve" });
    };
    
    const handleReject = () => {
      const reason = prompt("Please provide a reason for rejection:");
      callTool({ 
        action: "reject", 
        reason: reason || "No reason provided" 
      });
    };
    
    const handleEdit = () => {
      // Open edit modal/form
      const modified = {
        ...request,
        quantity: parseInt(prompt("New quantity:") || request.quantity.toString()),
        max_price: parseFloat(prompt("New max price:") || request.max_price.toString())
      };
      
      callTool({ 
        action: "edit", 
        modified_request: modified 
      });
    };
    
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Purchase Approval Required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Purchase Details */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="font-medium">Symbol:</span>
            <span>{request.symbol}</span>
            <span className="font-medium">Quantity:</span>
            <span>{request.quantity} shares</span>
            <span className="font-medium">Max Price:</span>
            <span>${request.max_price}</span>
            <span className="font-medium">Estimated Cost:</span>
            <span>${request.estimated_cost}</span>
            <span className="font-medium">Risk Level:</span>
            <span className="capitalize">{request.risk_level}</span>
          </div>
          
          {/* Risk Assessment */}
          <div className="bg-yellow-50 p-3 rounded-lg">
            <h4 className="font-semibold text-sm mb-1">Risk Assessment</h4>
            <p className="text-xs text-gray-600">{risk_assessment.recommendation}</p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button 
              variant="outline" 
              onClick={handleReject}
              disabled={status.type === "executing"}
            >
              Reject
            </Button>
            <Button 
              variant="secondary" 
              onClick={handleEdit}
              disabled={status.type === "executing"}
            >
              Edit & Approve
            </Button>
            <Button 
              onClick={handleApprove}
              disabled={status.type === "executing"}
            >
              Approve
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
});
```

### Multi-Step Form Tool UI

```typescript
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type UserInfoFormArgs = {
  step: number;
  fields: string[];
  title: string;
  data: Record<string, any>;
};

export const UserInfoFormTool = makeAssistantToolUI<UserInfoFormArgs, any>({
  toolName: "user_info_form",
  render: function UserInfoFormUI({ args, callTool, status }) {
    const [formData, setFormData] = useState(args.data || {});
    const [errors, setErrors] = useState<Record<string, string>>({});
    
    const validateForm = () => {
      const newErrors: Record<string, string> = {};
      
      if (args.step === 1) {
        if (!formData.name) newErrors.name = "Name is required";
        if (!formData.email) newErrors.email = "Email is required";
        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          newErrors.email = "Invalid email format";
        }
      }
      
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };
    
    const handleSubmit = () => {
      if (validateForm()) {
        callTool(formData);
      }
    };
    
    const updateField = (field: string, value: string) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      // Clear error when user starts typing
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: "" }));
      }
    };
    
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>{args.title}</CardTitle>
          <p className="text-sm text-gray-600">Step {args.step} of 3</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {args.step === 1 && (
            <>
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name || ""}
                  onChange={(e) => updateField("name", e.target.value)}
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>
              
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => updateField("email", e.target.value)}
                  className={errors.email ? "border-red-500" : ""}
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>
              
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone || ""}
                  onChange={(e) => updateField("phone", e.target.value)}
                />
              </div>
            </>
          )}
          
          {args.step === 2 && (
            <>
              <div>
                <Label>Investment Experience</Label>
                <Select 
                  value={formData.investment_experience || ""} 
                  onValueChange={(value) => updateField("investment_experience", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select experience level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner (0-2 years)</SelectItem>
                    <SelectItem value="intermediate">Intermediate (2-5 years)</SelectItem>
                    <SelectItem value="advanced">Advanced (5+ years)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Risk Tolerance</Label>
                <Select 
                  value={formData.risk_tolerance || ""} 
                  onValueChange={(value) => updateField("risk_tolerance", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select risk tolerance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservative</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          
          <Button 
            onClick={handleSubmit} 
            disabled={status.type === "executing"}
            className="w-full"
          >
            {args.step < 3 ? "Next" : "Complete"}
          </Button>
        </CardContent>
      </Card>
    );
  }
});
```

### Review and Edit Tool UI

```typescript
import { useState } from "react";

type ReviewFormArgs = {
  step: number;
  title: string;
  data: Record<string, any>;
  editable: boolean;
};

export const ReviewFormTool = makeAssistantToolUI<ReviewFormArgs, any>({
  toolName: "review_form",
  render: function ReviewFormUI({ args, callTool, status }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState(args.data);
    
    const handleSubmit = () => {
      callTool({ 
        action: "submit", 
        final_data: editData 
      });
    };
    
    const handleEdit = (step: number) => {
      callTool({ 
        action: "edit", 
        go_to_step: step 
      });
    };
    
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>{args.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Personal Information */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold">Personal Information</h4>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleEdit(1)}
              >
                Edit
              </Button>
            </div>
            <div className="text-sm space-y-1">
              <p><strong>Name:</strong> {args.data.name}</p>
              <p><strong>Email:</strong> {args.data.email}</p>
              <p><strong>Phone:</strong> {args.data.phone || "Not provided"}</p>
            </div>
          </div>
          
          {/* Investment Preferences */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold">Investment Preferences</h4>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleEdit(2)}
              >
                Edit
              </Button>
            </div>
            <div className="text-sm space-y-1">
              <p><strong>Experience:</strong> {args.data.investment_experience}</p>
              <p><strong>Risk Tolerance:</strong> {args.data.risk_tolerance}</p>
            </div>
          </div>
          
          {/* Submit Button */}
          <Button 
            onClick={handleSubmit} 
            disabled={status.type === "executing"}
            className="w-full"
          >
            Submit Information
          </Button>
        </CardContent>
      </Card>
    );
  }
});
```

## Complete Working Examples

### 1. Stock Purchase Workflow

This example demonstrates a complete stock purchase approval system with rich UI components.

**Backend (Python):**

```python
from typing import TypedDict, Optional, Literal
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import StateGraph
from langgraph.types import interrupt, Command
from langgraph.checkpoint.sqlite import SqliteSaver
import json
import uuid

class StockPurchaseState(TypedDict):
    messages: list
    purchase_request: Optional[dict]
    market_analysis: Optional[dict]
    approval_status: Optional[str]
    transaction_result: Optional[dict]

def analyze_market(state: StockPurchaseState) -> dict:
    """Analyze market conditions and create purchase recommendation."""
    # Simulate market analysis
    symbol = "AAPL"  # Would extract from user message in real implementation
    
    analysis = {
        "symbol": symbol,
        "current_price": 148.50,
        "recommended_quantity": 100,
        "price_target": 155.00,
        "risk_assessment": "Medium",
        "market_trend": "Bullish",
        "analyst_rating": "Buy"
    }
    
    purchase_request = {
        "symbol": symbol,
        "quantity": analysis["recommended_quantity"],
        "max_price": analysis["current_price"] * 1.02,  # 2% above current
        "estimated_cost": analysis["recommended_quantity"] * analysis["current_price"],
        "order_type": "market"
    }
    
    return {
        "market_analysis": analysis,
        "purchase_request": purchase_request,
        "messages": [AIMessage(f"Analysis complete for {symbol}. Requesting approval for purchase.")]
    }

def request_approval(state: StockPurchaseState) -> Command[Literal["execute_purchase", "cancel_purchase"]]:
    """Request human approval for the stock purchase."""
    
    approval_response = interrupt({
        "tool": "stock_purchase_approval",
        "args": {
            "purchase_request": state["purchase_request"],
            "market_analysis": state["market_analysis"],
            "warnings": [
                "Market volatility is currently medium",
                "Consider your portfolio allocation"
            ]
        }
    })
    
    if approval_response["action"] == "approve":
        return Command(
            goto="execute_purchase",
            update={"approval_status": "approved"}
        )
    elif approval_response["action"] == "modify":
        # User modified the request
        modified_request = approval_response["modified_request"]
        return Command(
            goto="execute_purchase",
            update={
                "approval_status": "approved_with_modifications",
                "purchase_request": modified_request
            }
        )
    else:
        return Command(
            goto="cancel_purchase",
            update={
                "approval_status": "rejected",
                "rejection_reason": approval_response.get("reason", "User cancelled")
            }
        )

def execute_purchase(state: StockPurchaseState) -> dict:
    """Execute the approved stock purchase."""
    request = state["purchase_request"]
    
    # Simulate order execution
    transaction = {
        "transaction_id": f"TXN-{uuid.uuid4().hex[:8].upper()}",
        "symbol": request["symbol"],
        "quantity": request["quantity"],
        "executed_price": request["max_price"] * 0.995,  # Slightly better execution
        "total_cost": request["quantity"] * request["max_price"] * 0.995,
        "execution_time": "2024-01-15T14:30:00Z",
        "status": "completed"
    }
    
    success_message = (
        f"🎉 Purchase executed successfully!\n\n"
        f"**Transaction Details:**\n"
        f"• ID: {transaction['transaction_id']}\n"
        f"• Symbol: {transaction['symbol']}\n"
        f"• Quantity: {transaction['quantity']} shares\n"
        f"• Price: ${transaction['executed_price']:.2f} per share\n"
        f"• Total Cost: ${transaction['total_cost']:.2f}\n"
        f"• Status: {transaction['status'].title()}"
    )
    
    return {
        "transaction_result": transaction,
        "messages": [AIMessage(success_message)]
    }

def cancel_purchase(state: StockPurchaseState) -> dict:
    """Cancel the purchase request."""
    reason = state.get("rejection_reason", "User cancelled the transaction")
    
    return {
        "messages": [AIMessage(f"❌ Purchase cancelled. Reason: {reason}")]
    }

# Build the workflow
def create_stock_purchase_workflow():
    checkpointer = SqliteSaver.from_conn_string("stock_purchase.db")
    
    builder = StateGraph(StockPurchaseState)
    
    # Add nodes
    builder.add_node("analyze_market", analyze_market)
    builder.add_node("request_approval", request_approval)
    builder.add_node("execute_purchase", execute_purchase)
    builder.add_node("cancel_purchase", cancel_purchase)
    
    # Define flow
    builder.set_entry_point("analyze_market")
    builder.add_edge("analyze_market", "request_approval")
    builder.add_edge("execute_purchase", "__end__")
    builder.add_edge("cancel_purchase", "__end__")
    
    return builder.compile(checkpointer=checkpointer)

# Usage example
if __name__ == "__main__":
    workflow = create_stock_purchase_workflow()
    config = {"configurable": {"thread_id": "user-123"}}
    
    # Start the workflow
    initial_state = {
        "messages": [HumanMessage("I want to buy some Apple stock")]
    }
    
    result = workflow.invoke(initial_state, config)
    
    # Check for interrupts
    if "__interrupt__" in result:
        print("Interrupt triggered:")
        print(json.dumps(result["__interrupt__"], indent=2))
        
        # Simulate user approval
        approval_decision = {"action": "approve"}
        
        # Resume the workflow
        final_result = workflow.invoke(
            Command(resume=approval_decision), 
            config
        )
        print("Final result:", final_result["messages"][-1].content)
```

**Frontend (TypeScript):**

```typescript
// StockPurchaseApprovalTool.tsx
import React, { useState } from "react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUpIcon, AlertTriangleIcon, DollarSignIcon } from "lucide-react";

type StockPurchaseApprovalArgs = {
  purchase_request: {
    symbol: string;
    quantity: number;
    max_price: number;
    estimated_cost: number;
    order_type: string;
  };
  market_analysis: {
    symbol: string;
    current_price: number;
    price_target: number;
    risk_assessment: string;
    market_trend: string;
    analyst_rating: string;
  };
  warnings: string[];
};

export const StockPurchaseApprovalTool = makeAssistantToolUI<
  StockPurchaseApprovalArgs,
  any
>({
  toolName: "stock_purchase_approval",
  render: function StockPurchaseApprovalUI({ args, callTool, status }) {
    const { purchase_request, market_analysis, warnings } = args;
    const [isModifying, setIsModifying] = useState(false);
    const [modifiedRequest, setModifiedRequest] = useState(purchase_request);
    const [rejectionReason, setRejectionReason] = useState("");

    const handleApprove = () => {
      callTool({ action: "approve" });
    };

    const handleModify = () => {
      callTool({
        action: "modify",
        modified_request: modifiedRequest,
      });
    };

    const handleReject = () => {
      if (!rejectionReason.trim()) {
        alert("Please provide a reason for rejection");
        return;
      }
      callTool({
        action: "reject",
        reason: rejectionReason,
      });
    };

    const isLoading = status.type === "executing";

    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSignIcon className="w-5 h-5" />
            Stock Purchase Approval Required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Market Analysis Section */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <TrendingUpIcon className="w-4 h-4" />
              Market Analysis
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Current Price:</span>
                <span className="ml-2">${market_analysis.current_price}</span>
              </div>
              <div>
                <span className="font-medium">Price Target:</span>
                <span className="ml-2">${market_analysis.price_target}</span>
              </div>
              <div>
                <span className="font-medium">Trend:</span>
                <span className={`ml-2 ${
                  market_analysis.market_trend === "Bullish" 
                    ? "text-green-600" 
                    : "text-red-600"
                }`}>
                  {market_analysis.market_trend}
                </span>
              </div>
              <div>
                <span className="font-medium">Rating:</span>
                <span className="ml-2">{market_analysis.analyst_rating}</span>
              </div>
              <div>
                <span className="font-medium">Risk:</span>
                <span className="ml-2">{market_analysis.risk_assessment}</span>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <Alert>
              <AlertTriangleIcon className="w-4 h-4" />
              <AlertDescription>
                <ul className="list-disc ml-4 space-y-1">
                  {warnings.map((warning, index) => (
                    <li key={index} className="text-sm">{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Purchase Request Details */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Purchase Details</h3>
            
            {!isModifying ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Symbol:</span>
                  <span className="ml-2">{purchase_request.symbol}</span>
                </div>
                <div>
                  <span className="font-medium">Quantity:</span>
                  <span className="ml-2">{purchase_request.quantity} shares</span>
                </div>
                <div>
                  <span className="font-medium">Max Price:</span>
                  <span className="ml-2">${purchase_request.max_price.toFixed(2)}</span>
                </div>
                <div>
                  <span className="font-medium">Estimated Cost:</span>
                  <span className="ml-2 font-semibold">
                    ${purchase_request.estimated_cost.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Order Type:</span>
                  <span className="ml-2 capitalize">{purchase_request.order_type}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={modifiedRequest.quantity}
                    onChange={(e) =>
                      setModifiedRequest(prev => ({
                        ...prev,
                        quantity: parseInt(e.target.value) || 0,
                        estimated_cost: (parseInt(e.target.value) || 0) * prev.max_price
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="maxPrice">Max Price per Share</Label>
                  <Input
                    id="maxPrice"
                    type="number"
                    step="0.01"
                    value={modifiedRequest.max_price}
                    onChange={(e) =>
                      setModifiedRequest(prev => ({
                        ...prev,
                        max_price: parseFloat(e.target.value) || 0,
                        estimated_cost: prev.quantity * (parseFloat(e.target.value) || 0)
                      }))
                    }
                  />
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Updated Estimated Cost:</span>
                  <span className="ml-2 font-semibold text-lg">
                    ${modifiedRequest.estimated_cost.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Rejection Reason (when rejecting) */}
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">
              Rejection Reason (optional, but recommended)
            </Label>
            <Input
              id="rejection-reason"
              placeholder="Enter reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isLoading}
              className="flex-1"
            >
              Reject Purchase
            </Button>
            
            {!isModifying ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsModifying(true)}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Modify & Approve
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Approve Purchase
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsModifying(false);
                    setModifiedRequest(purchase_request);
                  }}
                  disabled={isLoading}
                >
                  Cancel Edit
                </Button>
                <Button
                  onClick={handleModify}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Approve Modified Purchase
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  },
});
```

### 2. Document Review and Edit Workflow

**Backend (Python):**

```python
from typing import TypedDict, Optional
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import StateGraph
from langgraph.types import interrupt, Command

class DocumentReviewState(TypedDict):
    messages: list
    document_content: Optional[str]
    review_stage: Optional[str]
    revisions: list
    final_approved: bool

def generate_document(state: DocumentReviewState) -> dict:
    """Generate initial document content."""
    # Simulate document generation based on user request
    content = """# Investment Proposal: Apple Inc. (AAPL)

## Executive Summary
Based on our analysis, we recommend a strategic investment in Apple Inc. (AAPL) for the following reasons:

### Key Investment Thesis
1. **Strong fundamentals**: Consistent revenue growth and profitability
2. **Innovation pipeline**: Continued product innovation and market expansion
3. **Market position**: Dominant position in premium consumer electronics
4. **Financial strength**: Strong balance sheet and cash generation

### Recommendation
- **Action**: BUY
- **Target allocation**: 5-10% of portfolio
- **Price target**: $155-160 per share
- **Time horizon**: 12-18 months

## Risk Factors
- Market volatility and economic uncertainty
- Increased competition in key markets
- Regulatory challenges in major markets

## Conclusion
Apple presents a compelling investment opportunity with strong fundamentals and growth potential."""
    
    return {
        "document_content": content,
        "review_stage": "initial_review",
        "revisions": [],
        "messages": [AIMessage("Document generated. Please review and provide feedback.")]
    }

def request_document_review(state: DocumentReviewState) -> dict:
    """Request human review of the document."""
    
    review_response = interrupt({
        "tool": "document_review",
        "args": {
            "content": state["document_content"],
            "stage": state["review_stage"],
            "revision_history": state.get("revisions", [])
        }
    })
    
    if review_response["action"] == "approve":
        return {
            "final_approved": True,
            "messages": [AIMessage("✅ Document approved and finalized!")]
        }
    elif review_response["action"] == "revise":
        # Add revision to history
        new_revisions = state.get("revisions", []).copy()
        new_revisions.append({
            "timestamp": "2024-01-15T14:30:00Z",
            "feedback": review_response["feedback"],
            "revised_content": review_response["revised_content"]
        })
        
        return {
            "document_content": review_response["revised_content"],
            "revisions": new_revisions,
            "review_stage": "revision_review",
            "messages": [AIMessage("Document revised based on your feedback. Please review the changes.")]
        }
    else:
        return {
            "messages": [AIMessage("❌ Document review cancelled.")]
        }

def build_document_workflow():
    checkpointer = SqliteSaver.from_conn_string("document_review.db")
    
    builder = StateGraph(DocumentReviewState)
    builder.add_node("generate", generate_document)
    builder.add_node("review", request_document_review)
    
    builder.set_entry_point("generate")
    builder.add_edge("generate", "review")
    
    # Add conditional edge for review cycle
    def should_continue_review(state: DocumentReviewState) -> str:
        if state.get("final_approved"):
            return "__end__"
        else:
            return "review"
    
    builder.add_conditional_edges("review", should_continue_review)
    
    return builder.compile(checkpointer=checkpointer)
```

**Frontend (TypeScript):**

```typescript
// DocumentReviewTool.tsx
import React, { useState } from "react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileTextIcon, EditIcon, CheckIcon, XIcon } from "lucide-react";

type DocumentReviewArgs = {
  content: string;
  stage: string;
  revision_history: Array<{
    timestamp: string;
    feedback: string;
    revised_content: string;
  }>;
};

export const DocumentReviewTool = makeAssistantToolUI<DocumentReviewArgs, any>({
  toolName: "document_review",
  render: function DocumentReviewUI({ args, callTool, status }) {
    const { content, stage, revision_history } = args;
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(content);
    const [feedback, setFeedback] = useState("");
    const [activeTab, setActiveTab] = useState<"document" | "history">("document");

    const handleApprove = () => {
      callTool({ action: "approve" });
    };

    const handleRevise = () => {
      if (!feedback.trim()) {
        alert("Please provide feedback for the revision");
        return;
      }
      
      callTool({
        action: "revise",
        feedback: feedback,
        revised_content: editedContent
      });
    };

    const handleCancel = () => {
      callTool({ action: "cancel" });
    };

    const isLoading = status.type === "executing";

    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileTextIcon className="w-5 h-5" />
              Document Review
            </CardTitle>
            <Badge variant={stage === "initial_review" ? "default" : "secondary"}>
              {stage.replace("_", " ").toUpperCase()}
            </Badge>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex gap-2 mt-4">
            <Button
              variant={activeTab === "document" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("document")}
            >
              Document
            </Button>
            <Button
              variant={activeTab === "history" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("history")}
              disabled={revision_history.length === 0}
            >
              History ({revision_history.length})
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {activeTab === "document" ? (
            <>
              {/* Document Content */}
              <div className="border rounded-lg">
                <div className="flex items-center justify-between p-3 border-b bg-gray-50">
                  <span className="font-medium">Document Content</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    <EditIcon className="w-4 h-4 mr-1" />
                    {isEditing ? "View Mode" : "Edit Mode"}
                  </Button>
                </div>
                
                <div className="p-4">
                  {isEditing ? (
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="min-h-[400px] font-mono text-sm"
                      placeholder="Edit document content..."
                    />
                  ) : (
                    <div className="prose max-w-none">
                      <pre className="whitespace-pre-wrap text-sm">
                        {editedContent}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Feedback Section */}
              <div>
                <Label htmlFor="feedback">
                  Feedback for Revision (required if requesting changes)
                </Label>
                <Textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Provide specific feedback on what needs to be changed..."
                  className="min-h-[100px]"
                />
              </div>
            </>
          ) : (
            /* Revision History */
            <div className="space-y-4">
              <h3 className="font-semibold">Revision History</h3>
              {revision_history.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No revisions yet
                </p>
              ) : (
                <div className="space-y-4">
                  {revision_history.map((revision, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">Revision {index + 1}</Badge>
                        <span className="text-sm text-gray-500">
                          {new Date(revision.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <h4 className="font-medium text-sm">Feedback:</h4>
                          <p className="text-sm text-gray-600">
                            {revision.feedback}
                          </p>
                        </div>
                        <details className="text-sm">
                          <summary className="font-medium cursor-pointer">
                            View revised content
                          </summary>
                          <div className="mt-2 p-2 bg-gray-50 rounded border">
                            <pre className="whitespace-pre-wrap text-xs">
                              {revision.revised_content.substring(0, 500)}
                              {revision.revised_content.length > 500 ? "..." : ""}
                            </pre>
                          </div>
                        </details>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {activeTab === "document" && (
            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={isLoading}
              >
                <XIcon className="w-4 h-4 mr-1" />
                Cancel Review
              </Button>
              
              <Button
                variant="outline"
                onClick={handleRevise}
                disabled={isLoading || !feedback.trim()}
                className="flex-1"
              >
                <EditIcon className="w-4 h-4 mr-1" />
                Request Revision
              </Button>
              
              <Button
                onClick={handleApprove}
                disabled={isLoading}
                className="flex-1"
              >
                <CheckIcon className="w-4 h-4 mr-1" />
                Approve Document
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
});
```

## Advanced Patterns

### 1. Parallel Interrupt Handling

When multiple nodes need approval simultaneously:

```python
from typing import TypedDict
from langgraph.graph import StateGraph
from langgraph.types import interrupt, Command
from langgraph.constants import START

class ParallelState(TypedDict):
    messages: list
    budget_approved: Optional[bool]
    legal_approved: Optional[bool]
    technical_approved: Optional[bool]

def budget_approval(state: ParallelState) -> dict:
    """Budget team approval node."""
    approval = interrupt({
        "tool": "budget_approval",
        "args": {"department": "budget", "amount": 50000}
    })
    return {"budget_approved": approval["approved"]}

def legal_approval(state: ParallelState) -> dict:
    """Legal team approval node."""
    approval = interrupt({
        "tool": "legal_approval", 
        "args": {"department": "legal", "contract_terms": "..."}
    })
    return {"legal_approved": approval["approved"]}

def technical_approval(state: ParallelState) -> dict:
    """Technical team approval node."""
    approval = interrupt({
        "tool": "technical_approval",
        "args": {"department": "technical", "requirements": "..."}
    })
    return {"technical_approved": approval["approved"]}

# Build parallel approval workflow
builder = StateGraph(ParallelState)
builder.add_node("budget", budget_approval)
builder.add_node("legal", legal_approval) 
builder.add_node("technical", technical_approval)

# All run in parallel from START
builder.add_edge(START, "budget")
builder.add_edge(START, "legal")
builder.add_edge(START, "technical")

graph = builder.compile(checkpointer=checkpointer)

# Usage - resume multiple interrupts at once
config = {"configurable": {"thread_id": "parallel-approval"}}
result = graph.invoke({}, config)

# Get all interrupts and respond to them
interrupts = graph.get_state(config).interrupts
resume_map = {
    i.id: {"approved": True}  # Approve all for this example
    for i in interrupts
}

# Resume all at once
final_result = graph.invoke(Command(resume=resume_map), config)
```

### 2. Conditional Interrupt Logic

Interrupts based on dynamic conditions:

```python
def conditional_approval(state: State) -> dict:
    """Only interrupt for high-value transactions."""
    amount = state["transaction_amount"]
    
    if amount > 10000:
        # High-value transaction needs approval
        approval = interrupt({
            "tool": "high_value_approval",
            "args": {
                "amount": amount,
                "requires_manager": amount > 50000,
                "requires_director": amount > 100000
            }
        })
        return {"approved": approval["approved"]}
    else:
        # Auto-approve low-value transactions
        return {
            "approved": True,
            "messages": [AIMessage(f"Auto-approved transaction of ${amount}")]
        }
```

### 3. Multi-Step Validation with Retry Logic

```python
def validation_with_retry(state: FormState) -> dict:
    """Validate form data with retry capability."""
    max_retries = 3
    current_attempt = state.get("validation_attempts", 0)
    
    if current_attempt >= max_retries:
        return {
            "messages": [AIMessage("❌ Maximum validation attempts exceeded.")],
            "form_valid": False
        }
    
    validation_response = interrupt({
        "tool": "form_validator",
        "args": {
            "form_data": state["form_data"],
            "attempt": current_attempt + 1,
            "max_attempts": max_retries,
            "previous_errors": state.get("validation_errors", [])
        }
    })
    
    if validation_response["valid"]:
        return {
            "form_valid": True,
            "messages": [AIMessage("✅ Form validation successful!")]
        }
    else:
        return {
            "validation_attempts": current_attempt + 1,
            "validation_errors": validation_response["errors"],
            "messages": [AIMessage(
                f"❌ Validation failed. Attempt {current_attempt + 1}/{max_retries}. "
                f"Please fix the errors and try again."
            )]
        }
```

### 4. Dynamic Tool Selection

```python
def dynamic_approval_selector(state: State) -> dict:
    """Select appropriate approval tool based on context."""
    request_type = state["request_type"]
    amount = state.get("amount", 0)
    
    if request_type == "purchase" and amount > 1000:
        tool_name = "purchase_approval"
        args = {"purchase_details": state["purchase_details"]}
    elif request_type == "expense":
        tool_name = "expense_approval" 
        args = {"expense_details": state["expense_details"]}
    elif request_type == "contract":
        tool_name = "contract_approval"
        args = {"contract_terms": state["contract_terms"]}
    else:
        # Default simple approval
        tool_name = "simple_approval"
        args = {"request": state["request"]}
    
    approval = interrupt({
        "tool": tool_name,
        "args": args
    })
    
    return {"approved": approval["approved"]}
```

## Best Practices

### 1. State Management

```python
# ✅ Good: Clean state structure
class WorkflowState(TypedDict):
    # Core data
    messages: Annotated[list[BaseMessage], add_messages]
    
    # Workflow-specific data
    current_step: str
    form_data: dict
    
    # Interrupt-specific data  
    pending_approvals: list[dict]
    approval_results: dict
    
    # Status flags
    workflow_complete: bool
    errors: list[str]

# ❌ Bad: Cluttered state
class BadState(TypedDict):
    messages: list
    data1: str
    data2: int
    flag1: bool
    flag2: bool
    temp_var: str
    # ... many more fields
```

### 2. Error Handling

```python
def robust_interrupt_node(state: State) -> dict:
    """Interrupt node with proper error handling."""
    try:
        result = interrupt({
            "tool": "approval_tool",
            "args": state["approval_data"],
            "timeout": 300  # 5 minute timeout
        })
        
        # Validate interrupt response
        if not isinstance(result, dict) or "approved" not in result:
            raise ValueError("Invalid interrupt response format")
            
        return {
            "approved": result["approved"],
            "approval_reason": result.get("reason", "")
        }
        
    except Exception as e:
        # Log error and provide fallback
        return {
            "approved": False,
            "error": f"Approval process failed: {str(e)}",
            "messages": [AIMessage("❌ Approval process encountered an error. Please try again.")]
        }
```

### 3. Frontend Tool UI Best Practices

```typescript
// ✅ Good: Proper error handling and loading states
export const WellDesignedTool = makeAssistantToolUI({
  toolName: "well_designed_tool",
  render: function WellDesignedToolUI({ args, callTool, status }) {
    const [localState, setLocalState] = useState(initializeState(args));
    const [errors, setErrors] = useState<Record<string, string>>({});
    
    const isLoading = status.type === "executing";
    const hasErrors = Object.keys(errors).length > 0;
    
    const handleSubmit = async () => {
      // Validate before sending
      const validationErrors = validateInput(localState);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
      
      try {
        await callTool(localState);
      } catch (error) {
        console.error("Tool call failed:", error);
        // Handle error appropriately
      }
    };
    
    return (
      <Card>
        <CardContent>
          {/* Show loading state */}
          {isLoading && <LoadingSpinner />}
          
          {/* Show validation errors */}
          {hasErrors && <ErrorDisplay errors={errors} />}
          
          {/* Main UI content */}
          <FormContent 
            data={localState}
            onChange={setLocalState}
            disabled={isLoading}
          />
          
          <Button 
            onClick={handleSubmit}
            disabled={isLoading || hasErrors}
          >
            Submit
          </Button>
        </CardContent>
      </Card>
    );
  }
});
```

### 4. Thread Management

```typescript
// Proper thread and interrupt management
const MyAssistantWithInterrupts: React.FC = () => {
  const threadIdRef = useRef<string>();
  
  const runtime = useLangGraphRuntime({
    threadId: threadIdRef.current,
    stream: async (messages) => {
      if (!threadIdRef.current) {
        const { thread_id } = await createThread();
        threadIdRef.current = thread_id;
      }
      
      return sendMessage({
        threadId: threadIdRef.current,
        messages,
      });
    },
    onSwitchToThread: async (threadId) => {
      const state = await getThreadState(threadId);
      threadIdRef.current = threadId;
      
      return {
        messages: state.values.messages || [],
        // ✅ Important: Include interrupts for proper restoration
        interrupts: state.tasks[0]?.interrupts || [],
      };
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
      {/* Include all your Tool UI components */}
      <PurchaseApprovalTool />
      <DocumentReviewTool />
      <FormValidatorTool />
    </AssistantRuntimeProvider>
  );
};
```

## Integration with ScottishAILessons

### Adding Interrupts to Existing Agents

Based on your codebase structure, here's how to integrate interrupts:

1. **Update Agent Logic** (`agents/shared_chat_logic.py`):

```python
# Add interrupt support to your existing agents
from langgraph.types import interrupt

class TeachingAgent:
    def __init__(self, llm):
        self.llm = llm
    
    def generate_lesson_plan(self, state):
        """Generate lesson plan with approval gate."""
        # Generate initial lesson plan
        lesson_plan = self.llm.invoke(
            "Create a lesson plan for: " + state["topic"]
        )
        
        # Request teacher approval
        approval = interrupt({
            "tool": "lesson_plan_approval",
            "args": {
                "lesson_plan": lesson_plan.content,
                "topic": state["topic"],
                "grade_level": state.get("grade_level"),
                "duration": state.get("duration", "45 minutes")
            }
        })
        
        if approval["approved"]:
            return {"lesson_plan": lesson_plan.content}
        else:
            # Handle revisions or cancellation
            return {"lesson_plan": None, "cancelled": True}
```

2. **Frontend Integration** (`assistant-ui-frontend/components/`):

```typescript
// Add to your MyAssistant component
import { LessonPlanApprovalTool } from './tools/LessonPlanApprovalTool';
import { QuizApprovalTool } from './tools/QuizApprovalTool';

export function MyAssistant() {
  // ... existing code ...
  
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
      
      {/* Add your interrupt tools */}
      <LessonPlanApprovalTool />
      <QuizApprovalTool />
      <GradingApprovalTool />
    </AssistantRuntimeProvider>
  );
}
```

3. **Create Education-Specific Tools**:

```typescript
// components/tools/LessonPlanApprovalTool.tsx
export const LessonPlanApprovalTool = makeAssistantToolUI({
  toolName: "lesson_plan_approval",
  render: function LessonPlanApprovalUI({ args, callTool, status }) {
    const { lesson_plan, topic, grade_level, duration } = args;
    
    return (
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Lesson Plan Approval</CardTitle>
          <div className="flex gap-2">
            <Badge>Topic: {topic}</Badge>
            <Badge>Grade: {grade_level}</Badge>
            <Badge>Duration: {duration}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Lesson plan preview */}
          <div className="prose max-w-none mb-6">
            <ReactMarkdown>{lesson_plan}</ReactMarkdown>
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-3">
            <Button 
              variant="destructive"
              onClick={() => callTool({ approved: false })}
            >
              Reject
            </Button>
            <Button 
              variant="outline"
              onClick={() => callTool({ 
                approved: false, 
                request_revision: true 
              })}
            >
              Request Changes
            </Button>
            <Button 
              onClick={() => callTool({ approved: true })}
            >
              Approve Lesson Plan
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
});
```

### Environment Setup

Update your `.env.local` files to include interrupt settings:

```env
# .env.local.langgraph
NEXT_PUBLIC_LANGGRAPH_API_URL=http://localhost:2024
NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID=your_agent_id
ENABLE_INTERRUPTS=true
INTERRUPT_TIMEOUT=300

# .env.local.aegra  
NEXT_PUBLIC_LANGGRAPH_API_URL=http://localhost:8000
NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID=your_agent_id
ENABLE_INTERRUPTS=true
INTERRUPT_TIMEOUT=300
```

### Testing Your Interrupt Workflows

Create test cases for your interrupt flows:

```python
# tests/test_interrupts.py
import pytest
from agents.teaching_agent import TeachingWorkflow

@pytest.fixture
def workflow():
    return TeachingWorkflow()

def test_lesson_plan_approval_flow(workflow):
    """Test the lesson plan approval interrupt."""
    config = {"configurable": {"thread_id": "test-thread"}}
    
    # Start workflow
    result = workflow.invoke({
        "topic": "Photosynthesis",
        "grade_level": "7th Grade"
    }, config)
    
    # Should have an interrupt
    assert "__interrupt__" in result
    interrupt_data = result["__interrupt__"][0]
    assert interrupt_data.value["tool"] == "lesson_plan_approval"
    
    # Simulate approval
    approved_result = workflow.invoke(
        Command(resume={"approved": True}), 
        config
    )
    
    assert "lesson_plan" in approved_result
    assert approved_result["lesson_plan"] is not None

def test_lesson_plan_rejection_flow(workflow):
    """Test lesson plan rejection and revision."""
    config = {"configurable": {"thread_id": "test-thread-2"}}
    
    # Start and reject
    result = workflow.invoke({
        "topic": "Advanced Calculus",
        "grade_level": "5th Grade"  # Inappropriate level
    }, config)
    
    rejected_result = workflow.invoke(
        Command(resume={
            "approved": False, 
            "request_revision": True,
            "feedback": "Too advanced for 5th grade"
        }), 
        config
    )
    
    # Should trigger revision cycle
    assert "revision_requested" in rejected_result
```

## Conclusion

This comprehensive guide provides everything needed to implement sophisticated human-in-the-loop workflows using LangGraph interrupts with assistant-ui. The patterns shown here enable:

- **Rich approval workflows** with custom UI components
- **Multi-step form collection** with validation
- **Document review and editing** cycles
- **Parallel approval processes** 
- **Dynamic interrupt logic** based on context

Key takeaways:

1. **Always use checkpointers** - Required for interrupt functionality
2. **Design clear Tool UIs** - Users need intuitive interfaces for decisions
3. **Handle errors gracefully** - Interrupts can fail, plan for it
4. **Structure state cleanly** - Maintainable state makes debugging easier
5. **Test interrupt flows** - Complex flows need thorough testing

The ScottishAILessons integration examples show how to add these patterns to your existing educational AI agents, enabling teacher oversight and approval of AI-generated content like lesson plans, quizzes, and assignments.