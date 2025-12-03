import subprocess
import time
import requests
import sys
import os
import signal

def verify():
    # Start the Flask app
    print("Starting Flask app...")
    # Using 'py' because 'python' command failed earlier for the user
    process = subprocess.Popen(["py", "app.py"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    
    try:
        # Wait for server to start
        print("Waiting for server to start...")
        time.sleep(10)
        
        # Test the endpoint
        print("Testing /get endpoint...")
        try:
            response = requests.post("http://127.0.0.1:5000/get", data={"msg": "Hello, are you working?"})
            
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
            
            if response.status_code == 200 and len(response.text) > 0 and not response.text.startswith("Error:"):
                print("Verification SUCCESS!")
            else:
                print(f"Verification FAILED! Response: {response.text}")
        except requests.exceptions.ConnectionError:
            print("Could not connect to server. It might not have started.")
            # Print stdout/stderr to debug
            outs, errs = process.communicate(timeout=1)
            print(f"STDOUT: {outs}")
            print(f"STDERR: {errs}")
            
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        # Kill the server
        print("Stopping Flask app...")
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()

if __name__ == "__main__":
    verify()
