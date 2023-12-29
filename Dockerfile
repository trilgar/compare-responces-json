# Use an official Node.js runtime as a parent image
FROM node:14

# Set the working directory to /app
WORKDIR /app

# Copy package.json and package-lock.json to /app
COPY package*.json ./

# Install app dependencies
RUN npm install

# Bundle app source
COPY GetRequestDetailsFromCollection.js .

# Expose the port that your application is running on (if applicable)
EXPOSE 9080

# Define the command to run your application
CMD ["node", "GetRequestDetailsFromCollection.js"]
