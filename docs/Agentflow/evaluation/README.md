# Evaluation Framework Documentation

This folder contains comprehensive documentation for the Agentflow evaluation framework.

## Documentation Structure

### Core Documentation

1. **[index.md](index.md)** - Overview and introduction
   - Why evaluate agents differently
   - Core concepts (EvalSet, Criteria, Reporters)
   - Quick start guide
   - Module structure

2. **[getting-started.md](getting-started.md)** - Your first evaluation
   - Creating evaluation sets (programmatic & JSON)
   - Configuring criteria
   - Running the evaluator
   - Viewing and exporting results
   - Common patterns

3. **[data-models.md](data-models.md)** - Data structures in detail
   - EvalSet and EvalCase
   - Invocation and MessageContent
   - ToolCall and TrajectoryStep
   - SessionInput
   - EvalConfig and CriterionConfig
   - Result models (EvalReport, EvalSummary, etc.)
   - JSON file conventions

### Feature Documentation

4. **[criteria.md](criteria.md)** - All evaluation criteria
   - Base criterion interface
   - Trajectory criteria (tool call validation)
   - Response criteria (text similarity, exact match)
   - LLM-as-judge criteria (semantic matching, rubrics)
   - Advanced criteria (hallucination, safety, factual accuracy)
   - Composite criteria
   - Creating custom criteria
   - Configuration and best practices

5. **[reporters.md](reporters.md)** - Output formatting
   - ConsoleReporter (terminal output)
   - JSONReporter (data export)
   - JUnitXMLReporter (CI/CD integration)
   - HTMLReporter (interactive reports)
   - Using multiple reporters
   - Custom reporters
   - CI/CD integration examples

6. **[pytest-integration.md](pytest-integration.md)** - Testing integration
   - `@eval_test` decorator
   - Assertion helpers
   - Parametrized tests
   - Fixtures
   - Test organization
   - Markers and filtering
   - CI/CD workflows
   - Best practices

7. **[user-simulation.md](user-simulation.md)** - Dynamic testing
   - Why user simulation
   - ConversationScenario
   - UserSimulator and SimulationResult
   - Creating scenarios
   - Running simulations (single & batch)
   - Goal checking
   - Integration with evaluation
   - Advanced usage (personas, stress testing)

8. **[advanced.md](advanced.md)** - Advanced patterns
   - Custom criteria implementations
   - Multi-agent evaluation
   - RAG-specific evaluation
   - Batch processing
   - Regression testing
   - Cost optimization
   - Best practices summary

## Quick Navigation

**Getting Started:**
- New to evaluation? Start with [index.md](index.md) → [getting-started.md](getting-started.md)
- Need data structures? See [data-models.md](data-models.md)

**By Feature:**
- Validating tool calls? → [criteria.md](criteria.md#trajectory-criteria)
- Response quality? → [criteria.md](criteria.md#llm-as-judge-criteria)
- Safety checks? → [criteria.md](criteria.md#advanced-criteria)
- Output formats? → [reporters.md](reporters.md)
- pytest integration? → [pytest-integration.md](pytest-integration.md)
- Dynamic testing? → [user-simulation.md](user-simulation.md)

**By Use Case:**
- CI/CD integration → [reporters.md](reporters.md#cicd-integration) + [pytest-integration.md](pytest-integration.md#cicd-integration)
- Multi-agent systems → [advanced.md](advanced.md#multi-agent-evaluation)
- RAG applications → [advanced.md](advanced.md#rag-specific-evaluation)
- Cost optimization → [advanced.md](advanced.md#cost-optimization)
- Regression tracking → [advanced.md](advanced.md#regression-testing)

## Documentation Coverage

### Topics Covered

✅ Core evaluation concepts and workflow
✅ Data models and JSON schemas
✅ All built-in criteria (trajectory, response, LLM-as-judge, advanced)
✅ All reporters (console, JSON, JUnit, HTML)
✅ Pytest integration patterns
✅ User simulation for dynamic testing
✅ Custom criteria creation
✅ Multi-agent evaluation
✅ RAG-specific evaluation
✅ Regression testing
✅ Cost optimization strategies
✅ CI/CD integration examples
✅ Best practices throughout

### Code Examples

Every documentation page includes:
- Runnable code examples
- Configuration examples
- Real-world use cases
- Common patterns
- Troubleshooting tips

### Audience

- **Beginners**: Start with index.md and getting-started.md
- **Practitioners**: Jump to specific feature docs (criteria, reporters, etc.)
- **Advanced users**: See advanced.md for patterns and optimization
- **Teams**: Use pytest-integration.md for CI/CD setup

## Related Documentation

- [AGENT_EVALUATION_PLAN.md](../../plans/AGENT_EVALUATION_PLAN.md) - Original implementation plan
- [Tutorial/](../../Tutorial/) - General Agentflow tutorials
- [Concept/graph/](../graph/) - Graph orchestration concepts
- [Concept/context/](../context/) - State and message handling

## Contributing

When adding to this documentation:

1. Follow the existing structure and style
2. Include runnable code examples
3. Add troubleshooting sections where appropriate
4. Link to related documentation
5. Update this README if adding new files

## Viewing the Documentation

These markdown files are part of the MkDocs documentation site:

```bash
# Install dependencies
pip install mkdocs mkdocs-material

# Serve locally
mkdocs serve

# View at http://127.0.0.1:8000
```

Navigate to **Concepts → Evaluation** in the site navigation.
