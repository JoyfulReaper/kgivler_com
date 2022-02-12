function getInput() {
    document.getElementById("outputPane").classList.add("invisible");

    let principal = document.getElementById("principal").value;
    let term = document.getElementById("term").value;
    let rate = document.getElementById("rate").value;

    principal = parseFloat(principal);
    term = parseFloat(term);
    rate = parseFloat(rate);

    if(isNaN(principal) || isNaN(term) || isNaN(rate)) {
        alert("Please enter valid numbers for the principal, term, and rate.");
        return;
    }

    let loanObj = calculateLoanData(principal, term, rate);

    displayResults(loanObj);
}

function calculateLoanData(principal, term, rate) {

    let monthly = principal * (rate / 1200) / (1 - (1 + rate/1200) ** -term);

    let loanObj = {
        Principal : principal,
        Term : term,
        Rate : rate,
        Monthly : monthly,
        Payments: []
    };

    let balance = principal;
    loanObj.TotalInterest = 0;
    for(let i = 0; i < term; i++) {
        let interest = principal * rate / 1200;
        let payment = monthly - interest;

        loanObj.TotalInterest += interest;
        let interestPaid = loanObj.TotalInterest;

        balance -= payment;

        let current = {
            Interest : interest,
            InterestPaid: interestPaid,
            PrincipalPaid: payment,
            Balance : balance
        }

        principal -= payment;

        loanObj.Payments.push(current);
    }

    return loanObj;
}

function displayResults(loanObj) {
    let tableBody = document.getElementById("results");
    let templateRow = document.getElementById("tableTemplate");

    tableBody.innerHTML = "";

    for(let i = 0; i < loanObj.Payments.length; i++) {
        let tableRow = document.importNode(templateRow.content, true);

        let rowCols = tableRow.querySelectorAll("td");
        rowCols[0].textContent = i + 1;
        rowCols[1].textContent = loanObj.Monthly.toFixed(2);
        rowCols[2].textContent = loanObj.Payments[i].PrincipalPaid.toFixed(2);
        rowCols[3].textContent = loanObj.Payments[i].Interest.toFixed(2);
        rowCols[4].textContent = loanObj.Payments[i].InterestPaid.toFixed(2);
        rowCols[5].textContent = loanObj.Payments[i].Balance.toFixed(2);

        tableBody.appendChild(tableRow);
    }

    var formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      });

    document.getElementById("payment").innerHTML = `${formatter.format(loanObj.Monthly)}`;
    document.getElementById("totalPrincipal").innerHTML = `${formatter.format(loanObj.Principal)}`;
    document.getElementById("interest").innerHTML = `${formatter.format((loanObj.TotalInterest))}`;
    document.getElementById("total").innerHTML = `<strong>${formatter.format((loanObj.Principal + loanObj.TotalInterest))}</strong>`;

    document.getElementById("outputPane").classList.remove("invisible");
}