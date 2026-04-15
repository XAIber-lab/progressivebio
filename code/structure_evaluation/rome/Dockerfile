# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Install essential tools and libraries for building C extensions
# Install Graphviz and the Graphviz development package
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    graphviz \
    libgraphviz-dev \
    pkg-config && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy the current directory contents into the container at /usr/src/app
COPY . .

# Install PyGraphviz
RUN pip install pygraphviz

RUN pip install -r requirements.txt

# Command to run the application
# CMD ["python", "my_script.py"]