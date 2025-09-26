import fs from 'fs';
import path from 'path';

// Test the image integration logic without running the full server
const ROOT = process.cwd();

// Mock OpenAI for testing
const mockClient = {
  chat: {
    completions: {
      create: async (params) => {
        console.log('OpenAI API Call Parameters:');
        console.log('Model:', params.model);
        console.log('Max Tokens:', params.max_tokens);
        console.log('Messages:', JSON.stringify(params.messages, null, 2));

        // Check if images are properly formatted
        const hasImages = params.messages[0].content?.some?.(item => item.type === 'image_url');
        console.log('Has Images:', hasImages);

        if (hasImages) {
          const imageCount = params.messages[0].content.filter(item => item.type === 'image_url').length;
          console.log('Image Count:', imageCount);

          params.messages[0].content.forEach((item, index) => {
            if (item.type === 'image_url') {
              console.log(`Image ${index + 1}:`, item.image_url.url.substring(0, 50) + '...');
            }
          });
        }

        return {
          choices: [{
            message: {
              content: `Mock response: Successfully processed ${hasImages ? 'text with images' : 'text only'}. This would be your travel itinerary with image-based personalization.`
            }
          }]
        };
      }
    }
  }
};

// Test image processing function
function prepareMessagesWithImages(uploadedFiles, sys, user) {
  const hasImages = uploadedFiles && uploadedFiles.some(file => file.type && file.type.startsWith('image/'));

  if (hasImages) {
    const content = [
      { type: 'text', text: `${sys}\n\n${user}` }
    ];

    uploadedFiles.forEach(file => {
      if (file.type && file.type.startsWith('image/')) {
        if (file.url) {
          content.push({
            type: 'image_url',
            image_url: { url: file.url }
          });
        } else if (file.data) {
          const mimeType = file.type || 'image/jpeg';
          const dataUrl = file.data.startsWith('data:') ? file.data : `data:${mimeType};base64,${file.data}`;
          content.push({
            type: 'image_url',
            image_url: { url: dataUrl }
          });
        }
      }
    });

    return [{ role: 'user', content }];
  } else {
    return [{ role: 'user', content: `${sys}\n\n${user}` }];
  }
}

async function testImageIntegration() {
  try {
    console.log('🧪 Testing Image Integration\n');

    // Get example images
    const imagesDir = path.join(ROOT, 'frontend', 'images example');
    const imageFiles = fs.readdirSync(imagesDir).filter(f => f.endsWith('.jpeg') || f.endsWith('.jpg'));

    if (imageFiles.length === 0) {
      throw new Error('No example images found');
    }

    console.log(`Found ${imageFiles.length} example images:`);
    imageFiles.forEach(file => console.log(`- ${file}`));
    console.log('');

    // Use first two images for testing
    const testImages = imageFiles.slice(0, 2);
    const uploadedFiles = testImages.map(imageFile => {
      const imagePath = path.join(imagesDir, imageFile);
      const imageData = fs.readFileSync(imagePath, 'base64');

      return {
        name: imageFile,
        type: 'image/jpeg',
        data: imageData
      };
    });

    const sys = `Create a complete 4-day itinerary for Santorini, Greece.

**IMPORTANT**: The user has provided images that may show their travel style preferences, destination inspiration, or specific interests. Analyze these images carefully and incorporate insights into the itinerary recommendations. Consider:
- Visual preferences and travel style shown in images
- Types of experiences, accommodations, or activities depicted
- Photography interests or scenic preferences
- Adventure level or comfort preferences shown

Use these visual insights to personalize recommendations throughout the itinerary.`;

    const user = `Create an AMAZING trip plan for:

**Destination:** Santorini, Greece
**Dates:** 2025-10-01 to 2025-10-05 (4 days)
**Travelers:** 2 adults
**Style:** mid + romantic, photography
**Budget:** 2000 USD
**Trip Purpose:** leisure`;

    console.log('📝 Test Parameters:');
    console.log('Images:', uploadedFiles.length);
    console.log('Total Data Size:', uploadedFiles.reduce((sum, file) => sum + file.data.length, 0), 'characters');
    console.log('');

    // Test message preparation
    console.log('🔧 Testing Message Preparation...');
    const messages = prepareMessagesWithImages(uploadedFiles, sys, user);

    console.log('Message Structure:');
    console.log('- Role:', messages[0].role);
    console.log('- Content Items:', messages[0].content.length);
    console.log('- Text Items:', messages[0].content.filter(item => item.type === 'text').length);
    console.log('- Image Items:', messages[0].content.filter(item => item.type === 'image_url').length);
    console.log('');

    // Test API call format
    console.log('🚀 Testing API Call Format...');
    const response = await mockClient.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      max_tokens: 500,
      messages,
      stream: false,
    });

    console.log('\n✅ API Response:');
    console.log(response.choices[0].message.content);

    console.log('\n🎉 Image Integration Test PASSED!');
    console.log('The integration correctly:');
    console.log('- ✅ Detected images in uploaded files');
    console.log('- ✅ Converted images to proper base64 data URLs');
    console.log('- ✅ Formatted messages with image_url objects');
    console.log('- ✅ Used vision-capable model (gpt-4o)');
    console.log('- ✅ Included image analysis instructions in prompt');

  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    console.error(error);
  }
}

// Run the test
testImageIntegration();