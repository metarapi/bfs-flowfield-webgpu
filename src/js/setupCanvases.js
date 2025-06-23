// import { initWebGPU } from './initWebGPU.js';

export async function setupCanvases(device) {
    // const device = await initWebGPU();

    // Get a WebGPU context for each canvas and configure it
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    const infos = [];

    const obstacleCanvas = document.getElementById('obstacleCanvas');
    const distanceCanvas = document.getElementById('distanceCanvas');
    const flowfieldCanvas = document.getElementById('flowfieldCanvas');
    const canvases = [obstacleCanvas, distanceCanvas, flowfieldCanvas];

    for (const canvas of canvases) {
        if (canvas) { // Check if canvas exists
            const context = canvas.getContext('webgpu');
            context.configure({
                device,
                format: presentationFormat,
            });
            infos.push({ canvas, context });
        }
    }

    console.log("Canvas contexts configured:", infos);

    // Optional: Render test triangles (can be removed later)
    // await renderTestTriangles(device, infos, presentationFormat);

    return {
        obstacleCanvas,
        distanceCanvas,
        flowfieldCanvas,
        contexts: infos
    };
}

// Separate function for test rendering (optional)
async function renderTestTriangles(device, infos, presentationFormat) {
    const moduleRed = device.createShaderModule({
        label: 'our hardcoded red triangle shaders',
        code: `
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> @builtin(position) vec4f {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );

        return vec4f(pos[vertexIndex], 0.0, 1.0);
      }

      @fragment fn fs() -> @location(0) vec4f {
        return vec4f(1, 0, 0, 1);
      }
    `,
    });

    const moduleGreen = device.createShaderModule({
        label: 'our hardcoded green triangle shaders',
        code: `
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> @builtin(position) vec4f {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );

        return vec4f(pos[vertexIndex], 0.0, 1.0);
      }

      @fragment fn fs() -> @location(0) vec4f {
        return vec4f(0, 1, 0, 1);
      }
    `,
    });

    const moduleBlue = device.createShaderModule({
        label: 'our hardcoded blue triangle shaders',
        code: `
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> @builtin(position) vec4f {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );

        return vec4f(pos[vertexIndex], 0.0, 1.0);
      }

      @fragment fn fs() -> @location(0) vec4f {
        return vec4f(0, 0, 1, 1);
      }
    `,
    });

    const pipelineRed = device.createRenderPipeline({
        label: 'our hardcoded red triangle pipeline',
        layout: 'auto',
        vertex: {
            module: moduleRed,
            entryPoint: 'vs',
        },
        fragment: {
            module: moduleRed,
            entryPoint: 'fs',
            targets: [{ format: presentationFormat }],
        },
    });

    const pipelineBlue = device.createRenderPipeline({
        label: 'our hardcoded blue triangle pipeline',
        layout: 'auto',
        vertex: {
            module: moduleBlue,
            entryPoint: 'vs',
        },
        fragment: {
            module: moduleBlue,
            entryPoint: 'fs',
            targets: [{ format: presentationFormat }],
        },
    });

    const pipelineGreen = device.createRenderPipeline({
        label: 'our hardcoded green triangle pipeline',
        layout: 'auto',
        vertex: {
            module: moduleGreen,
            entryPoint: 'vs',
        },
        fragment: {
            module: moduleGreen,
            entryPoint: 'fs',
            targets: [{ format: presentationFormat }],
        },
    });

    const pipelines = [pipelineRed, pipelineGreen, pipelineBlue];

    const renderPassDescriptor = {
        label: 'our basic canvas renderPass',
        colorAttachments: [
            {
                // view: <- to be filled out when we render
                clearValue: [0.3, 0.3, 0.3, 1],
                loadOp: 'clear',
                storeOp: 'store',
            },
        ],
    };

    function render() {
        // make a command encoder to start encoding commands
        const encoder = device.createCommandEncoder({ label: 'our encoder' });

        for (let i = 0; i < infos.length; ++i) {
            const { context } = infos[i];
            const pipeline = pipelines[i];
            // Get the current texture from the canvas context and
            // set it as the texture to render to.
            renderPassDescriptor.colorAttachments[0].view =
                context.getCurrentTexture().createView();

            // make a render pass encoder to encode render specific commands
            const pass = encoder.beginRenderPass(renderPassDescriptor);
            pass.setPipeline(pipeline);
            pass.draw(3);  // call our vertex shader 3 times.
            pass.end();
        }

        const commandBuffer = encoder.finish();
        device.queue.submit([commandBuffer]);
    }

    render();
}

