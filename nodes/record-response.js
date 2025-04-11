// Record Response Node for Node-RED
module.exports = function(RED) {
  const customerDb = require('../customer-db');
  
  function RecordResponseNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    
    // Configuration
    this.responseField = config.responseField || "payload.response";
    
    function getValue(msg, path) {
      const parts = path.split('.');
      let value = msg;
      for (const part of parts) {
        if (value === undefined || value === null) return undefined;
        value = value[part];
      }
      return value;
    }
    
    node.on('input', function(msg) {
      try {
        // Skip if no conversation
        if (!msg.conversation || !msg.conversation.id) {
          node.status({fill:"yellow", shape:"ring", text:"No conversation found"});
          node.send(msg);
          return;
        }
        
        // Get the response content
        let responseContent = getValue(msg, node.responseField);
        
        if (responseContent === undefined) {
          if (typeof msg.payload === 'string') {
            responseContent = msg.payload;
          } else if (msg.payload.response) {
            responseContent = msg.payload.response;
          } else {
            responseContent = JSON.stringify(msg.payload);
          }
        }
        
        // Record the agent's response
        customerDb.addMessage(
          msg.conversation.id,
          responseContent,
          'agent'
        );
        
        // Update conversation in the message
        msg.conversation = customerDb.getConversation(msg.conversation.id);
        
        // Update history for next message
        msg.history = msg.conversation.messages.map(msg => ({
          role: msg.sender === 'customer' ? 'user' : 'assistant',
          content: msg.content
        }));
        
        node.status({fill:"green", shape:"dot", text:"Response recorded"});
        node.send(msg);
      } catch (error) {
        node.error(`Record response error: ${error.message}`, msg);
        node.status({fill:"red", shape:"dot", text:error.message});
        msg.error = error.message;
        node.send(msg);
      }
    });
  }
  
  RED.nodes.registerType("record-response", RecordResponseNode);
};
