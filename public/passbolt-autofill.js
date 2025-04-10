// Listen for messages from the parent window
window.addEventListener('message', function(event) {
  // Verify the message origin and type
  if (event.data.type !== 'PASSBOLT_AUTOFILL') return;

  const { username, password } = event.data.data;

  // Function to fill credentials
  const fillCredentials = () => {
    // Find the username and password fields
    const usernameField = document.querySelector('input[name="username"]');
    const passwordField = document.querySelector('input[name="password"]');
    const loginButton = document.querySelector('button[type="submit"], input[type="submit"]');

    // Fill in the credentials if fields are found
    if (usernameField && passwordField) {
      // Set values
      usernameField.value = username;
      passwordField.value = password;

      // Dispatch input events to trigger any listeners
      usernameField.dispatchEvent(new Event('input', { bubbles: true }));
      passwordField.dispatchEvent(new Event('input', { bubbles: true }));

      // Submit the form if a login button is found
      if (loginButton) {
        loginButton.click();
      }
    }
  };

  // Try to fill immediately
  fillCredentials();

  // If fields are not immediately available, retry a few times
  let attempts = 0;
  const maxAttempts = 5;
  const interval = setInterval(() => {
    attempts++;
    fillCredentials();
    
    if (attempts >= maxAttempts) {
      clearInterval(interval);
    }
  }, 1000);
}); 