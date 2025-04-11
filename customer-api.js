/**
 * Customer API endpoints for Node-RED integration
 * Provides HTTP endpoints for managing customers and conversations
 */

module.exports = function(RED) {
  const express = require('express');
  const bodyParser = require('body-parser');
  const customerDb = require('./customer-db');
  
  // Create a router for our API endpoints
  const apiRouter = express.Router();
  
  // Middleware
  apiRouter.use(bodyParser.json());
  
  // Authentication middleware (simple API key check)
  const authenticate = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    // In production, use a proper API key validation system
    // This is just a simple example
    if (!apiKey || apiKey !== 'your-secret-api-key') {
      return res.status(401).json({ 
        status: 'error', 
        message: 'Authentication required' 
      });
    }
    next();
  };
  
  // Enable CORS for all routes
  apiRouter.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 
      'Origin, X-Requested-With, Content-Type, Accept, X-API-Key, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
  
  // Customer endpoints
  
  // Get all customers
  apiRouter.get('/customers', authenticate, (req, res) => {
    try {
      const customers = customerDb.getAllCustomers();
      res.json({ status: 'success', customers });
    } catch (error) {
      res.status(500).json({ 
        status: 'error', 
        message: error.message 
      });
    }
  });
  
  // Find customer by ID or email
  apiRouter.get('/customers/find', authenticate, (req, res) => {
    try {
      const identifier = req.query.identifier;
      
      if (!identifier) {
        return res.status(400).json({ 
          status: 'error', 
          message: 'Identifier is required' 
        });
      }
      
      const customer = customerDb.findCustomer(identifier);
      
      if (!customer) {
        return res.status(404).json({ 
          status: 'error', 
          message: 'Customer not found' 
        });
      }
      
      res.json({ status: 'success', customer });
    } catch (error) {
      res.status(500).json({ 
        status: 'error', 
        message: error.message 
      });
    }
  });
  
  // Create new customer
  apiRouter.post('/customers', authenticate, (req, res) => {
    try {
      const customerData = req.body;
      
      // Check for minimum required data
      if (!customerData.email) {
        return res.status(400).json({ 
          status: 'error', 
          message: 'Email is required' 
        });
      }
      
      // Check if customer already exists with this email
      const existingCustomer = customerDb.findCustomer(customerData.email);
      if (existingCustomer) {
        return res.status(409).json({ 
          status: 'error', 
          message: 'Customer with this email already exists',
          customer: existingCustomer 
        });
      }
      
      const customer = customerDb.createCustomer(customerData);
      res.status(201).json({ status: 'success', customer });
    } catch (error) {
      res.status(500).json({ 
        status: 'error', 
        message: error.message 
      });
    }
  });
  
  // Update customer
  apiRouter.put('/customers/:id', authenticate, (req, res) => {
    try {
      const customerId = req.params.id;
      const customerData = req.body;
      
      const customer = customerDb.updateCustomer(customerId, customerData);
      res.json({ status: 'success', customer });
    } catch (error) {
      res.status(500).json({ 
        status: 'error', 
        message: error.message 
      });
    }
  });
  
  // Get customer conversations
  apiRouter.get('/customers/:id/conversations', authenticate, (req, res) => {
    try {
      const customerId = req.params.id;
      const conversations = customerDb.getCustomerConversations(customerId);
      res.json({ status: 'success', conversations });
    } catch (error) {
      res.status(500).json({ 
        status: 'error', 
        message: error.message 
      });
    }
  });
  
  // Conversation endpoints
  
  // Get conversation by ID
  apiRouter.get('/conversations/:id', authenticate, (req, res) => {
    try {
      const conversationId = req.params.id;
      const conversation = customerDb.getConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ 
          status: 'error', 
          message: 'Conversation not found' 
        });
      }
      
      res.json({ status: 'success', conversation });
    } catch (error) {
      res.status(500).json({ 
        status: 'error', 
        message: error.message 
      });
    }
  });
  
  // Create new conversation
  apiRouter.post('/conversations', authenticate, (req, res) => {
    try {
      const { customerId, initialMessage } = req.body;
      
      if (!customerId) {
        return res.status(400).json({ 
          status: 'error', 
          message: 'Customer ID is required' 
        });
      }
      
      const conversation = customerDb.createConversation(customerId, initialMessage);
      res.status(201).json({ status: 'success', conversation });
    } catch (error) {
      res.status(500).json({ 
        status: 'error', 
        message: error.message 
      });
    }
  });
  
  // Find or create active conversation
  apiRouter.post('/conversations/active', authenticate, (req, res) => {
    try {
      const { customerId, initialMessage } = req.body;
      
      if (!customerId) {
        return res.status(400).json({ 
          status: 'error', 
          message: 'Customer ID is required' 
        });
      }
      
      const conversation = customerDb.findOrCreateConversation(customerId, initialMessage);
      res.json({ status: 'success', conversation });
    } catch (error) {
      res.status(500).json({ 
        status: 'error', 
        message: error.message 
      });
    }
  });
  
  // Add message to conversation
  apiRouter.post('/conversations/:id/messages', authenticate, (req, res) => {
    try {
      const conversationId = req.params.id;
      const { content, sender } = req.body;
      
      if (!content) {
        return res.status(400).json({ 
          status: 'error', 
          message: 'Message content is required' 
        });
      }
      
      const message = customerDb.addMessage(conversationId, content, sender);
      res.status(201).json({ status: 'success', message });
    } catch (error) {
      res.status(500).json({ 
        status: 'error', 
        message: error.message 
      });
    }
  });
  
  // Update conversation status
  apiRouter.put('/conversations/:id/status', authenticate, (req, res) => {
    try {
      const conversationId = req.params.id;
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ 
          status: 'error', 
          message: 'Status is required' 
        });
      }
      
      const conversation = customerDb.updateConversationStatus(conversationId, status);
      res.json({ status: 'success', conversation });
    } catch (error) {
      res.status(500).json({ 
        status: 'error', 
        message: error.message 
      });
    }
  });
  
  // Update conversation context (for AI)
  apiRouter.put('/conversations/:id/context', authenticate, (req, res) => {
    try {
      const conversationId = req.params.id;
      const contextData = req.body;
      
      const conversation = customerDb.updateConversationContext(conversationId, contextData);
      res.json({ status: 'success', conversation });
    } catch (error) {
      res.status(500).json({ 
        status: 'error', 
        message: error.message 
      });
    }
  });
  
  // CRM integration endpoints
  
  // Link customer to CRM
  apiRouter.post('/crm/link', authenticate, (req, res) => {
    try {
      const { customerId, crmId } = req.body;
      
      if (!customerId || !crmId) {
        return res.status(400).json({ 
          status: 'error', 
          message: 'Customer ID and CRM ID are required' 
        });
      }
      
      const customer = customerDb.linkCustomerToCRM(customerId, crmId);
      res.json({ status: 'success', customer });
    } catch (error) {
      res.status(500).json({ 
        status: 'error', 
        message: error.message 
      });
    }
  });
  
  // Export customer data for CRM
  apiRouter.get('/crm/export/:customerId', authenticate, (req, res) => {
    try {
      const customerId = req.params.customerId;
      const data = customerDb.exportCustomerData(customerId);
      res.json({ status: 'success', data });
    } catch (error) {
      res.status(500).json({ 
        status: 'error', 
        message: error.message 
      });
    }
  });
  
  // Special endpoint for Node-RED to process a message with context
  apiRouter.post('/process', authenticate, async (req, res) => {
    try {
      const { 
        message, 
        customerId, 
        customerEmail,
        customerName,
        conversationId
      } = req.body;
      
      if (!message) {
        return res.status(400).json({ 
          status: 'error', 
          message: 'Message content is required' 
        });
      }
      
      // Identify or create customer
      let customer;
      if (customerId) {
        customer = customerDb.findCustomer(customerId);
      } else if (customerEmail) {
        customer = customerDb.findCustomer(customerEmail);
        if (!customer) {
          // Create new customer
          customer = customerDb.createCustomer({
            email: customerEmail,
            name: customerName || customerEmail.split('@')[0]
          });
        }
      } else {
        // Create anonymous customer
        customer = customerDb.createCustomer({
          name: 'Anonymous User'
        });
      }
      
      // Find or create conversation
      let conversation;
      if (conversationId) {
        conversation = customerDb.getConversation(conversationId);
        if (!conversation) {
          conversation = customerDb.createConversation(customer.id, message);
        } else {
          customerDb.addMessage(conversation.id, message, 'customer');
        }
      } else {
        conversation = customerDb.findOrCreateConversation(customer.id, message);
      }
      
      // Extract conversation history for context
      const messages = conversation.messages;
      const history = messages.map(msg => ({
        role: msg.sender === 'customer' ? 'user' : 'assistant',
        content: msg.content
      }));
      
      // Prepare response
      res.json({
        status: 'success',
        customer,
        conversation,
        history,
        currentMessage: message
      });
    } catch (error) {
      res.status(500).json({ 
        status: 'error', 
        message: error.message 
      });
    }
  });
  
  // Register our router with Node-RED
  RED.httpNode.use('/customer-api', apiRouter);
  
  // Create a Node-RED node type for customer management
  function CustomerProfileNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    
    node.on('input', function(msg) {
      try {
        const email = msg.payload.email || msg.customer?.email;
        
        // Skip if no identifying information
        if (!email) {
          node.send(msg);
          return;
        }
        
        // Try to find customer
        let customer = customerDb.findCustomer(email);
        
        // Create customer if not found
        if (!customer) {
          customer = customerDb.createCustomer({
            email: email,
            name: msg.payload.name || msg.customer?.name || email.split('@')[0]
          });
        }
        
        // Add or update customer in message
        msg.customer = customer;
        
        // Find or create active conversation
        const message = msg.payload.message || msg.payload;
        const conversation = customerDb.findOrCreateConversation(
          customer.id, 
          typeof message === 'string' ? message : null
        );
        
        // Add conversation to message
        msg.conversation = conversation;
        
        // Add conversation history for AI context
        msg.history = conversation.messages.map(msg => ({
          role: msg.sender === 'customer' ? 'user' : 'assistant',
          content: msg.content
        }));
        
        node.send(msg);
      } catch (error) {
        node.error(`Customer profile error: ${error.message}`, msg);
        msg.error = error.message;
        node.send(msg);
      }
    });
  }
  
  RED.nodes.registerType("customer-profile", CustomerProfileNode);
  
  // Create a Node-RED node type for recording responses
  function RecordResponseNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    
    node.on('input', function(msg) {
      try {
        // Skip if no conversation
        if (!msg.conversation || !msg.conversation.id) {
          node.send(msg);
          return;
        }
        
        // Get the response content
        let responseContent;
        if (msg.payload.response) {
          responseContent = msg.payload.response;
        } else if (typeof msg.payload === 'string') {
          responseContent = msg.payload;
        } else {
          responseContent = JSON.stringify(msg.payload);
        }
        
        // Record the agent's response
        customerDb.addMessage(
          msg.conversation.id,
          responseContent,
          'agent'
        );
        
        // Update conversation in the message
        msg.conversation = customerDb.getConversation(msg.conversation.id);
        
        node.send(msg);
      } catch (error) {
        node.error(`Record response error: ${error.message}`, msg);
        msg.error = error.message;
        node.send(msg);
      }
    });
  }
  
  RED.nodes.registerType("record-response", RecordResponseNode);
};
