// Customer Profile Node for Node-RED
module.exports = function(RED) {
  const customerDb = require('../customer-db');
  
  function CustomerProfileNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    
    // Configuration
    this.emailField = config.emailField || "payload.email";
    this.nameField = config.nameField || "payload.name";
    
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
        // Extract customer identification information
        const email = getValue(msg, node.emailField);
        const name = getValue(msg, node.nameField);
        
        // Skip if no identifying information
        if (!email && !msg.customer?.email && !msg.customer?.id) {
          node.status({fill:"yellow", shape:"ring", text:"No customer identified"});
          node.send(msg);
          return;
        }
        
        let customer;
        
        // If customer is already in the message, use that
        if (msg.customer && (msg.customer.id || msg.customer.email)) {
          customer = customerDb.findCustomer(msg.customer.id || msg.customer.email);
          if (!customer && msg.customer.email) {
            // Create customer if not found
            customer = customerDb.createCustomer({
              email: msg.customer.email,
              name: msg.customer.name || msg.customer.email.split('@')[0]
            });
          }
        } else if (email) {
          // Try to find customer by email
          customer = customerDb.findCustomer(email);
          
          // Create customer if not found
          if (!customer) {
            customer = customerDb.createCustomer({
              email: email,
              name: name || email.split('@')[0]
            });
          }
        }
        
        if (!customer) {
          node.status({fill:"red", shape:"ring", text:"Failed to identify customer"});
          node.send(msg);
          return;
        }
        
        // Add customer to message
        msg.customer = customer;
        
        // Extract message content
        let message;
        if (typeof msg.payload === 'string') {
          message = msg.payload;
        } else if (msg.payload && msg.payload.message) {
          message = msg.payload.message;
        }
        
        // Find or create active conversation
        const conversation = customerDb.findOrCreateConversation(
          customer.id, 
          message
        );
        
        // Add conversation to message
        msg.conversation = conversation;
        
        // Add conversation history for AI context
        msg.history = conversation.messages.map(msg => ({
          role: msg.sender === 'customer' ? 'user' : 'assistant',
          content: msg.content
        }));
        
        // Include conversation ID in the payload for tracking
        if (typeof msg.payload !== 'string') {
          msg.payload.conversationId = conversation.id;
        }
        
        node.status({fill:"green", shape:"dot", text:`Customer: ${customer.name || customer.email || customer.id}`});
        node.send(msg);
      } catch (error) {
        node.error(`Customer profile error: ${error.message}`, msg);
        node.status({fill:"red", shape:"dot", text:error.message});
        msg.error = error.message;
        node.send(msg);
      }
    });
  }
  
  RED.nodes.registerType("customer-profile", CustomerProfileNode);
};
