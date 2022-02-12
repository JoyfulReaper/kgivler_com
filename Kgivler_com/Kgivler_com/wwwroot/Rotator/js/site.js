function getInput() {

    document.getElementById("alert").classList.add("invisible");
    let input = document.getElementById("userString").value;

    let resultObj = isPalindrome(input);

    displayResult(resultObj);
}

function preparePhrase(input)
{
    input = input.toLowerCase(); // Lowercase
    input = input.replace(/\W/g, ''); // Remove non-alpha
    
    return input;
}

function isPalindrome(input) {

    let resultObj = {};
    let reversed = preparePhrase(input);
    let original = reversed;

    reversed = reversed.split("").reverse().join(""); // Reverse

    if(reversed == original) {
        resultObj.msg = "Well Done! You entered a palindrome!";
        resultObj.isPalindrome = true;
    }
    else {
        resultObj.msg = "Sorry! You didn't enter a palindrome!";
        resultObj.isPalindrome = false;
    }

    resultObj.reversed = reversed;

    return resultObj;
}

function displayResult(palindromeObj) {

    let message = [];
    if(palindromeObj.isPalindrome) {
        if(palindromeObj.reversed == "") {
            message = "I guess an empty string is a palindrome! "
        }
    }

    message += `Your phrase reversed is: ${palindromeObj.reversed}`;

    document.getElementById("resultHeader").innerHTML = palindromeObj.msg;
    document.getElementById("msg").innerHTML = message;
    document.getElementById("alert").classList.remove("invisible");
}