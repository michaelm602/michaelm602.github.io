<?php
    if (isset($_POST['submit'])) {
        $name = $_POST['firstname, lastname'];
        $email_from = $_POST['email'];
        $message = $_POST['message'];
        $selection = $_POST['selection'];
    }

    $emailTo = "michaelm602#yahoo.com";
    $headers = "From: ".$email_from;
    $txt = "You have a new email from ".$name.".\n\n".$message;

    mail($mailTo,$headers,$txt,$message,$selection,$email_from,$name);

    header("Location: index.html");

?>