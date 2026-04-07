# Graceful Shutdown Guide

This guide explains how to implement graceful shutdown in your Agentflow applications to ensure proper cleanup and resource management.

## Table of Contents
- [Overview](#overview)
- [Why Graceful Shutdown Matters](#why-graceful-shutdown-matters)
- [Quick Start](#quick-start)
- [Signal Handling](#signal-handling)
- [Shutdown Configuration](#shutdown-configuration)
- [Advanced Patterns](#advanced-patterns)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

Graceful shutdown ensures that when your application stops (via SIGTERM, SIGINT/Ctrl+C, or explicit shutdown), all resources are properly cleaned up:

- Background tasks complete or are cancelled cleanly
- State is persisted to checkpointer
- Event publishers flush pending messages
- Database connections are closed
- File handles are released

## Why Graceful Shutdown Matters

Without graceful shutdown:
- **Data loss**: Incomplete state persistence
- **Resource leaks**: Unclosed connections, file handles
- **Inconsistent state**: Partially completed operations
- **Poor user experience**: Abrupt termination

With graceful shutdown:
- **Data integrity**: All pending writes complete
- **Clean resources**: Proper cleanup of all handles
- **Predictable behavior**: Controlled shutdown sequence
- **Better debugging**: Clear shutdown logs

## Quick Start

### Basic Async Application

```python
import asyncio
from agentflow import StateGraph

async def main():
    # Build and compile graph with shutdown timeout
    graph = build_your_graph().compile(shutdown_timeout=30.0)
    
    try:
        result = await graph.ainvoke(input_data)
    finally:
        # Ensure cleanup even on errors
        stats = await graph.aclose()
        print(f"Shutdown complete: {stats}")

if __name__ == "__main__":
    asyncio.run(main())
```

### With Signal Handling

```python
import asyncio
import signal
from agentflow import StateGraph
from agentflow.utils import GracefulShutdownManager

async def main():
    # Create shutdown manager
    shutdown_manager = GracefulShutdownManager(shutdown_timeout=30.0)
    
    # Build graph
    graph = build_your_graph().compile(shutdown_timeout=30.0)
    
    # Register signal handlers for SIGTERM/SIGINT
    shutdown_manager.register_signal_handlers()
    
    try:
        # Run your application
        while not shutdown_manager.shutdown_requested:
            await process_next_item()
    except KeyboardInterrupt:
        print("Shutdown requested...")
    finally:
        # Cleanup
        await graph.aclose()
        shutdown_manager.unregister_signal_handlers()

if __name__ == "__main__":
    asyncio.run(main())
```

## Signal Handling

### Supported Signals

Agentflow handles these signals gracefully:

- **SIGINT**: Ctrl+C in terminal (Interactive shutdown)
- **SIGTERM**: Process termination signal (Container/service shutdown)

### How Signal Handling Works

1. Signal received → Handler registered
2. `shutdown_requested` flag set to `True`
3. Current operation completes
4. Cleanup sequence begins
5. All resources released within timeout

### Using GracefulShutdownManager

```python
from agentflow.utils import GracefulShutdownManager

async def main():
    shutdown_manager = GracefulShutdownManager(
        shutdown_timeout=30.0  # Total time for cleanup
    )
    
    # Register signal handlers
    shutdown_manager.register_signal_handlers()
    
    # Add custom shutdown callback
    def on_shutdown():
        print("Shutdown initiated!")
    
    shutdown_manager.add_shutdown_callback(on_shutdown)
    
    # Your application logic
    try:
        await run_app(shutdown_manager)
    finally:
        shutdown_manager.unregister_signal_handlers()
```

### Protecting Critical Sections

Some operations should never be interrupted (initialization, finalization):

```python
from agentflow.utils import DelayedKeyboardInterrupt

async def main():
    shutdown_manager = GracefulShutdownManager()
    
    # Protect initialization from interruption
    with shutdown_manager.protect_section():
        await initialize_database()
        await load_configuration()
        print("Initialization complete")
    
    # Normal execution (can be interrupted)
    try:
        await run_application()
    except KeyboardInterrupt:
        print("Shutdown requested")
    finally:
        # Protect cleanup from interruption
        with shutdown_manager.protect_section():
            await cleanup_resources()
            print("Cleanup complete")
```

## Shutdown Configuration

### Configure Timeout During Compilation

```python
from agentflow import StateGraph

graph = StateGraph()
# ... add nodes and edges ...

# Compile with shutdown timeout
compiled = graph.compile(
    checkpointer=my_checkpointer,
    shutdown_timeout=30.0  # 30 seconds for graceful shutdown
)
```

### Shutdown Sequence and Timing

The `shutdown_timeout` is divided among components:

1. **Background tasks**: Full timeout (30s)
2. **Checkpointer**: 1/3 of timeout (10s)
3. **Publisher**: 1/3 of timeout (10s)
4. **Store**: 1/3 of timeout (10s)

```python
# Example: 30-second timeout breakdown
shutdown_timeout = 30.0
- Background tasks: 30s (highest priority)
- Checkpointer: 10s (state persistence)
- Publisher: 10s (event delivery)
- Store: 10s (data writes)
```

### Shutdown Statistics

The `aclose()` method returns detailed statistics:

```python
stats = await graph.aclose()
# {
#   "background_tasks": {
#     "status": "completed",
#     "initial_tasks": 5,
#     "completed_tasks": 5,
#     "remaining_tasks": 0,
#     "duration_seconds": 2.5
#   },
#   "checkpointer": {
#     "status": "completed",
#     "duration": 1.2
#   },
#   "publisher": {
#     "status": "completed", 
#     "duration": 0.8
#   },
#   "store": {
#     "status": "skipped",
#     "reason": "no store"
#   },
#   "total_duration": 4.5
# }
```

## Advanced Patterns

### Pattern 1: Long-Running Service

```python
import asyncio
from agentflow import StateGraph
from agentflow.utils import GracefulShutdownManager

async def long_running_service():
    """Service that processes tasks until shutdown."""
    shutdown_manager = GracefulShutdownManager(shutdown_timeout=60.0)
    graph = build_graph().compile(shutdown_timeout=60.0)
    
    shutdown_manager.register_signal_handlers()
    
    try:
        # Protected initialization
        with shutdown_manager.protect_section():
            await connect_to_database()
            await load_models()
        
        # Main service loop
        while not shutdown_manager.shutdown_requested:
            try:
                # Process with timeout to check shutdown flag regularly
                task = await asyncio.wait_for(
                    get_next_task(),
                    timeout=1.0
                )
                await graph.ainvoke(task)
            except TimeoutError:
                continue  # No task available, check shutdown flag
                
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
    finally:
        # Protected cleanup
        with shutdown_manager.protect_section():
            await graph.aclose()
            await disconnect_from_database()
        shutdown_manager.unregister_signal_handlers()

if __name__ == "__main__":
    asyncio.run(long_running_service())
```

### Pattern 2: Kubernetes/Container Deployment

```python
import asyncio
import sys
from agentflow import StateGraph
from agentflow.utils import GracefulShutdownManager

async def container_app():
    """Application optimized for container deployment."""
    shutdown_manager = GracefulShutdownManager(
        shutdown_timeout=25.0  # Slightly less than K8s terminationGracePeriodSeconds
    )
    
    graph = build_graph().compile(shutdown_timeout=25.0)
    shutdown_manager.register_signal_handlers()
    
    try:
        # Application logic
        await run_server(shutdown_manager, graph)
    finally:
        # Ensure cleanup
        try:
            await asyncio.wait_for(
                graph.aclose(),
                timeout=25.0
            )
            sys.exit(0)
        except TimeoutError:
            logger.error("Shutdown timeout exceeded")
            sys.exit(1)

if __name__ == "__main__":
    asyncio.run(container_app())
```

**Kubernetes Deployment YAML:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentflow-service
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 30
      containers:
      - name: app
        image: my-agentflow-app:latest
        # App has 30s to shutdown gracefully
```

### Pattern 3: Multiple Graphs

```python
async def multi_graph_application():
    """Manage multiple graphs with coordinated shutdown."""
    shutdown_manager = GracefulShutdownManager(shutdown_timeout=45.0)
    
    # Create multiple graphs
    graph1 = build_graph1().compile(shutdown_timeout=15.0)
    graph2 = build_graph2().compile(shutdown_timeout=15.0)
    graph3 = build_graph3().compile(shutdown_timeout=15.0)
    
    shutdown_manager.register_signal_handlers()
    
    try:
        # Run graphs concurrently
        await asyncio.gather(
            process_with_graph(graph1, shutdown_manager),
            process_with_graph(graph2, shutdown_manager),
            process_with_graph(graph3, shutdown_manager),
        )
    finally:
        # Shutdown all graphs concurrently
        results = await asyncio.gather(
            graph1.aclose(),
            graph2.aclose(),
            graph3.aclose(),
            return_exceptions=True
        )
        
        for i, result in enumerate(results, 1):
            if isinstance(result, Exception):
                logger.error(f"Error closing graph {i}: {result}")
            else:
                logger.info(f"Graph {i} closed: {result}")
        
        shutdown_manager.unregister_signal_handlers()
```

### Pattern 4: Custom Cleanup Logic

```python
from agentflow.utils import shutdown_with_timeout

async def custom_cleanup():
    """Application with custom cleanup requirements."""
    graph = build_graph().compile(shutdown_timeout=30.0)
    external_service = await ExternalService.connect()
    
    try:
        result = await graph.ainvoke(input_data)
    finally:
        # Cleanup graph
        await graph.aclose()
        
        # Cleanup external service with timeout
        service_stats = await shutdown_with_timeout(
            external_service.disconnect(),
            timeout=10.0,
            task_name="external_service"
        )
        logger.info(f"External service shutdown: {service_stats}")
```

## Best Practices

### 1. Always Use Try-Finally

```python
# ✅ GOOD
async def main():
    graph = build_graph().compile()
    try:
        await graph.ainvoke(data)
    finally:
        await graph.aclose()  # Always executes

# ❌ BAD
async def main():
    graph = build_graph().compile()
    await graph.ainvoke(data)
    await graph.aclose()  # Skipped on exception!
```

### 2. Set Appropriate Timeouts

```python
# ✅ GOOD - Balanced timeouts
graph.compile(
    shutdown_timeout=30.0  # Reasonable for most apps
)

# ❌ BAD - Too short
graph.compile(
    shutdown_timeout=1.0  # May not finish cleanup!
)

# ⚠️ CAUTION - Very long
graph.compile(
    shutdown_timeout=300.0  # 5 minutes - only if needed
)
```

### 3. Log Shutdown Progress

```python
import logging

async def main():
    logger.info("Application starting...")
    graph = build_graph().compile(shutdown_timeout=30.0)
    
    try:
        logger.info("Processing started")
        await graph.ainvoke(data)
    except KeyboardInterrupt:
        logger.info("Shutdown signal received")
    finally:
        logger.info("Starting cleanup...")
        stats = await graph.aclose()
        logger.info(f"Cleanup completed: {stats}")
```

### 4. Protect Critical Sections

```python
from agentflow.utils import DelayedKeyboardInterrupt

async def main():
    # ✅ GOOD - Protect initialization
    with DelayedKeyboardInterrupt():
        await initialize_database()
    
    try:
        await run_application()
    finally:
        # ✅ GOOD - Protect cleanup
        with DelayedKeyboardInterrupt():
            await cleanup_database()
```

### 5. Test Shutdown Behavior

```python
import asyncio
import pytest

@pytest.mark.asyncio
async def test_graceful_shutdown():
    """Test that shutdown completes within timeout."""
    graph = build_test_graph().compile(shutdown_timeout=5.0)
    
    try:
        # Start some work
        task = asyncio.create_task(graph.ainvoke(test_data))
        await asyncio.sleep(0.1)
        
        # Cancel and shutdown
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
    finally:
        # Should complete within timeout
        start = asyncio.get_event_loop().time()
        stats = await graph.aclose()
        duration = asyncio.get_event_loop().time() - start
        
        assert duration < 5.0
        assert stats["background_tasks"]["status"] == "completed"
```

## Troubleshooting

### Issue: Shutdown Takes Too Long

**Symptoms**: Application hangs during shutdown

**Solutions**:
1. Increase `shutdown_timeout`:
   ```python
   graph.compile(shutdown_timeout=60.0)
   ```

2. Check for blocking operations:
   ```python
   # ❌ BAD - Blocks shutdown
   def node(state):
       time.sleep(100)  # Blocking!
   
   # ✅ GOOD - Respects cancellation
   async def node(state):
       await asyncio.sleep(100)  # Cancellable
   ```

3. Enable debug logging:
   ```python
   import logging
   logging.basicConfig(level=logging.DEBUG)
   ```

### Issue: Resources Not Cleaned Up

**Symptoms**: Open connections, file handles after shutdown

**Solutions**:
1. Use try-finally:
   ```python
   try:
       await graph.ainvoke(data)
   finally:
       await graph.aclose()  # Always runs
   ```

2. Check shutdown stats:
   ```python
   stats = await graph.aclose()
   if stats["checkpointer"]["status"] != "completed":
       logger.error("Checkpointer cleanup failed!")
   ```

### Issue: SIGTERM Not Handled

**Symptoms**: Container killed without cleanup

**Solutions**:
1. Register signal handlers:
   ```python
   shutdown_manager = GracefulShutdownManager()
   shutdown_manager.register_signal_handlers()
   ```

2. Ensure timeout < container terminationGracePeriod:
   ```python
   # Kubernetes gives 30s by default
   graph.compile(shutdown_timeout=25.0)  # Leave 5s buffer
   ```

### Issue: Shutdown Interrupted

**Symptoms**: KeyboardInterrupt during cleanup

**Solution**: Protect cleanup with DelayedKeyboardInterrupt:
```python
from agentflow.utils import DelayedKeyboardInterrupt

try:
    await run_app()
finally:
    # Won't be interrupted by Ctrl+C
    with DelayedKeyboardInterrupt():
        await graph.aclose()
```

## Platform-Specific Notes

### Linux/Unix
- SIGTERM and SIGINT handled normally
- Use `systemd` for service management
- Set `TimeoutStopSec` in service file

### Windows
- SIGTERM may have limited support
- Ctrl+C triggers SIGINT
- Use `python -m agentflow` for better signal handling

### macOS
- Same as Linux/Unix
- Command+C triggers SIGINT

### Docker/Kubernetes
- Use `STOPSIGNAL SIGTERM` in Dockerfile
- Set `terminationGracePeriodSeconds` in pod spec
- Ensure `shutdown_timeout < terminationGracePeriodSeconds`

## Example: Production-Ready Application

```python
import asyncio
import logging
import sys
from agentflow import StateGraph
from agentflow.utils import GracefulShutdownManager, DelayedKeyboardInterrupt

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def production_application():
    """Production-ready application with graceful shutdown."""
    # Configuration
    SHUTDOWN_TIMEOUT = 30.0
    
    # Create shutdown manager
    shutdown_manager = GracefulShutdownManager(
        shutdown_timeout=SHUTDOWN_TIMEOUT
    )
    
    # Build and compile graph
    logger.info("Building graph...")
    graph = build_production_graph().compile(
        checkpointer=get_checkpointer(),
        shutdown_timeout=SHUTDOWN_TIMEOUT
    )
    
    # Register signal handlers
    shutdown_manager.register_signal_handlers()
    logger.info("Signal handlers registered")
    
    try:
        # Protected initialization
        logger.info("Starting initialization...")
        with shutdown_manager.protect_section():
            await initialize_services()
            await connect_to_database()
            await load_ml_models()
        logger.info("Initialization complete")
        
        # Main application loop
        logger.info("Entering main loop...")
        while not shutdown_manager.shutdown_requested:
            try:
                # Process with timeout to check shutdown regularly
                task = await asyncio.wait_for(
                    get_next_task(),
                    timeout=1.0
                )
                result = await graph.ainvoke(task)
                await save_result(result)
            except TimeoutError:
                continue  # No task, check shutdown flag
            except Exception as e:
                logger.exception("Error processing task: %s", e)
                
    except KeyboardInterrupt:
        logger.info("Shutdown signal received (KeyboardInterrupt)")
    except Exception as e:
        logger.exception("Fatal error: %s", e)
        sys.exit(1)
    finally:
        # Protected cleanup
        logger.info("Starting cleanup...")
        with shutdown_manager.protect_section():
            # Close graph
            stats = await graph.aclose()
            logger.info(f"Graph closed: {stats}")
            
            # Additional cleanup
            await disconnect_from_database()
            await cleanup_services()
            
            # Unregister handlers
            shutdown_manager.unregister_signal_handlers()
            
        logger.info("Shutdown complete")
        sys.exit(0)

if __name__ == "__main__":
    try:
        asyncio.run(production_application())
    except KeyboardInterrupt:
        print("\nShutdown complete")
        sys.exit(0)
```

## References

- [Python asyncio documentation](https://docs.python.org/3/library/asyncio.html)
- [Graceful Shutdown Best Practices](https://github.com/wbenny/python-graceful-shutdown)
- [Kubernetes Termination](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination)
- [systemd Service Management](https://www.freedesktop.org/software/systemd/man/systemd.service.html)
