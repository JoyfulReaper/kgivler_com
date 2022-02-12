// Get the string entered
function getInput() {
    document.getElementById("alert").classList.add("invisible");

    let input = document.getElementById("userString").value;

    let reversedString = reverseString(input);

    displayString(reversedString);
}

// Reverse the string
function reverseString(userString) {
    let reversed = [];

    //Reverse string using a for loop - Method 1
    for(let i = 0; i < userString.length; i++) {
        reversed += userString[(userString.length - 1) - i];
    }

    // Reverse string using a for loop - Method 2
    //for(let i = userString.length - 1; i >= 0; i--) {
    //    reversed += userString[i];
    //}

    return reversed;
}

// Display the reversed string
function displayString(outputString) {
    //Write message to the page
    document.getElementById("msg").innerHTML = `Your string reversed is: ${outputString}`;

    // Show alert box
    document.getElementById("alert").classList.remove("invisible");
}