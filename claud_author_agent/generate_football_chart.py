import plotly.graph_objects as go

# Football teams and their goals data
teams = ["Rangers", "Celtic", "Hearts", "Hibs"]
goals = [6, 8, 5, 7]

# Create bar chart
fig = go.Figure(data=[
    go.Bar(
        x=teams,
        y=goals,
        marker=dict(
            color=['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'],
            line=dict(color='rgb(8,48,107)', width=1.5)
        ),
        text=goals,
        textposition='outside',
        textfont=dict(size=14, color='black')
    )
])

# Update layout
fig.update_layout(
    title=dict(
        text='Goals Scored by Football Teams in Tournament',
        font=dict(size=18, color='black')
    ),
    xaxis=dict(
        title=dict(text='Team', font=dict(size=14)),
        tickfont=dict(size=12)
    ),
    yaxis=dict(
        title=dict(text='Goals Scored', font=dict(size=14)),
        range=[0, 10],
        dtick=1,
        tickfont=dict(size=12),
        gridcolor='lightgray'
    ),
    plot_bgcolor='white',
    paper_bgcolor='white',
    margin=dict(l=60, r=40, t=80, b=60),
    showlegend=False,
    width=800,
    height=600
)

# Save the figure
fig.write_image('./diagrams/q_block_001_easy_002_question.png')
print("Diagram successfully saved to: ./diagrams/q_block_001_easy_002_question.png")
