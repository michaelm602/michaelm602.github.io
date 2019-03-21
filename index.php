<?php
if($_POST["message"]) {
    mail("michaelm602@yahoo.com", "Form to email message", $_POST["message"], "From: an@email.address");
}
?>

?>
<!DOCTYPE HTML>

<html>
<head>
<title>The Tattoo Spot</title>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
<link rel="stylesheet" href="main.css" />
<link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.7.2/css/all.css" integrity="sha384-fnmOCqbTlWIlj8LyTjo7mOUStjsKC4pOpQbqyi7RrhN7udi9RwhKkMHpvLbHG9Sr" crossorigin="anonymous">
<noscript>
<link rel="stylesheet" href="noscript.css" />
</noscript>
<script src="jssor.slider-27.5.0.min.js" type="text/javascript"></script> 

</head>
<body class="is-preload">

<!-- Wrapper -->
<div id="wrapper"> 
  
  <!-- Header -->
  <header id="header">
    <div class="content">
      <div class="inner">
        <h1>The Tattoo Spot</h1>
        <p></p>
      </div>
    </div>
    <nav>
      <ul>
        <li><a href="#intro">Intro</a></li>
        <li><a href="#work">Work</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </nav>
  </header>
  
  <!-- Main -->
  <div id="main"> 
    
    <!-- Intro -->
    <article id="intro">
      <h2 class="major">Introduction</h2>
      <span class="image main"><img src="black and grey ink dip.jpg" alt="" /></span>
      <p></p>
      <p>Quality tattoos at an affordable price. </p>
    </article>
    
    <!-- Work -->
    <article id="work">
      <h2 class="major">My Tattoo Work</h2>
      <!-- #region Jssor Slider Begin --> 
      <!-- Generator: Jssor Slider Maker --> 
      <script type="text/javascript">
        jssor_1_slider_init = function() {

            var jssor_1_SlideshowTransitions = [
              {$Duration:800,x:0.25,$Zoom:1.5,$Easing:{$Left:$Jease$.$InWave,$Zoom:$Jease$.$InCubic},$Opacity:2,$ZIndex:-10,$Brother:{$Duration:800,x:-0.25,$Zoom:1.5,$Easing:{$Left:$Jease$.$InWave,$Zoom:$Jease$.$InCubic},$Opacity:2,$ZIndex:-10}},
              {$Duration:1200,x:0.5,$Cols:2,$ChessMode:{$Column:3},$Easing:{$Left:$Jease$.$InOutCubic},$Opacity:2,$Brother:{$Duration:1200,$Opacity:2}},
              {$Duration:600,x:0.3,$During:{$Left:[0.6,0.4]},$Easing:{$Left:$Jease$.$InCubic,$Opacity:$Jease$.$Linear},$Opacity:2,$Brother:{$Duration:600,x:-0.3,$Easing:{$Left:$Jease$.$InCubic,$Opacity:$Jease$.$Linear},$Opacity:2}},
              {$Duration:800,x:0.25,y:0.5,$Rotate:-0.1,$Easing:{$Left:$Jease$.$InQuad,$Top:$Jease$.$InQuad,$Opacity:$Jease$.$Linear,$Rotate:$Jease$.$InQuad},$Opacity:2,$Brother:{$Duration:800,x:-0.1,y:-0.7,$Rotate:0.1,$Easing:{$Left:$Jease$.$InQuad,$Top:$Jease$.$InQuad,$Opacity:$Jease$.$Linear,$Rotate:$Jease$.$InQuad},$Opacity:2}},
              {$Duration:1000,x:1,$Rows:2,$ChessMode:{$Row:3},$Easing:{$Left:$Jease$.$InOutQuart,$Opacity:$Jease$.$Linear},$Opacity:2,$Brother:{$Duration:1000,x:-1,$Rows:2,$ChessMode:{$Row:3},$Easing:{$Left:$Jease$.$InOutQuart,$Opacity:$Jease$.$Linear},$Opacity:2}},
              {$Duration:1000,y:-1,$Cols:2,$ChessMode:{$Column:12},$Easing:{$Top:$Jease$.$InOutQuart,$Opacity:$Jease$.$Linear},$Opacity:2,$Brother:{$Duration:1000,y:1,$Cols:2,$ChessMode:{$Column:12},$Easing:{$Top:$Jease$.$InOutQuart,$Opacity:$Jease$.$Linear},$Opacity:2}},
              {$Duration:800,y:1,$Easing:{$Top:$Jease$.$InOutQuart,$Opacity:$Jease$.$Linear},$Opacity:2,$Brother:{$Duration:800,y:-1,$Easing:{$Top:$Jease$.$InOutQuart,$Opacity:$Jease$.$Linear},$Opacity:2}},
              {$Duration:1000,x:-0.1,y:-0.7,$Rotate:0.1,$During:{$Left:[0.6,0.4],$Top:[0.6,0.4],$Rotate:[0.6,0.4]},$Easing:{$Left:$Jease$.$InQuad,$Top:$Jease$.$InQuad,$Opacity:$Jease$.$Linear,$Rotate:$Jease$.$InQuad},$Opacity:2,$Brother:{$Duration:1000,x:0.2,y:0.5,$Rotate:-0.1,$Easing:{$Left:$Jease$.$InQuad,$Top:$Jease$.$InQuad,$Opacity:$Jease$.$Linear,$Rotate:$Jease$.$InQuad},$Opacity:2}},
              {$Duration:800,x:-0.2,$Delay:40,$Cols:12,$During:{$Left:[0.4,0.6]},$SlideOut:true,$Formation:$JssorSlideshowFormations$.$FormationStraight,$Assembly:260,$Easing:{$Left:$Jease$.$InOutExpo,$Opacity:$Jease$.$InOutQuad},$Opacity:2,$Outside:true,$Round:{$Top:0.5},$Brother:{$Duration:800,x:0.2,$Delay:40,$Cols:12,$Formation:$JssorSlideshowFormations$.$FormationStraight,$Assembly:1028,$Easing:{$Left:$Jease$.$InOutExpo,$Opacity:$Jease$.$InOutQuad},$Opacity:2,$Round:{$Top:0.5},$Shift:-200}},
              {$Duration:700,$Opacity:2,$Brother:{$Duration:700,$Opacity:2}},
              {$Duration:800,x:1,$Easing:{$Left:$Jease$.$InOutQuart,$Opacity:$Jease$.$Linear},$Opacity:2,$Brother:{$Duration:800,x:-1,$Easing:{$Left:$Jease$.$InOutQuart,$Opacity:$Jease$.$Linear},$Opacity:2}}
            ];

            var jssor_1_options = {
              $AutoPlay: 1,
              $FillMode: 5,
              $SlideshowOptions: {
                $Class: $JssorSlideshowRunner$,
                $Transitions: jssor_1_SlideshowTransitions,
                $TransitionsOrder: 1
              },
              $ArrowNavigatorOptions: {
                $Class: $JssorArrowNavigator$
              },
              $BulletNavigatorOptions: {
                $Class: $JssorBulletNavigator$
              }
            };

            var jssor_1_slider = new $JssorSlider$("jssor_1", jssor_1_options);

            /*#region responsive code begin*/

            var MAX_WIDTH = 600;

            function ScaleSlider() {
                var containerElement = jssor_1_slider.$Elmt.parentNode;
                var containerWidth = containerElement.clientWidth;



                if (containerWidth) {

                    var expectedWidth = Math.min(MAX_WIDTH || containerWidth, containerWidth);

                    jssor_1_slider.$ScaleWidth(expectedWidth);
                }
                else {
                    window.setTimeout(ScaleSlider, 30);
                }
            }

            ScaleSlider();

            $Jssor$.$AddEvent(window, "load", ScaleSlider);
            $Jssor$.$AddEvent(window, "resize", ScaleSlider);
            $Jssor$.$AddEvent(window, "orientationchange", ScaleSlider);
            /*#endregion responsive code end*/
        };
    </script>
      <div id="jssor_1"> 
        <!-- Loading Screen -->
        <div data-u="loading" class="jssorl-009-spin" style="position:absolute; top:0px; left:0px;  text-align:center; background-color:rgba(0,0,0,0.7);"> </div>
        <div data-u="slides" style="cursor: default; position: absolute; left: auto; width: 600px; height: 500px; margin-top: 0px; margin-right: auto; margin-left: auto; margin-bottom: 0px; right: auto; text-align: center;">
          <div class="article-image"> <img data-u="image" src="032.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="033.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="034.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="001.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="img001_1.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="001_2.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="007.jpg" alt="" /> </div>
          <div class="article-image"> <img data-u="image" src="006.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="008.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="009.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="010.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="011.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="012.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="013.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="014.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="015.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="016.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="017.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="018.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="020.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="019.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="021.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="022.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="023.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="024.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="025.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="026.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="027.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="028.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="029.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="030.jpg" alt=""/> </div>
          <div class="article-image"> <img data-u="image" src="031.jpg" alt=""/> </div>
        </div>
        
        <!-- Arrow Navigator -->
        <div data-u="arrowleft" class="jssora073" style="width:40px;height:50px;top:0px;left:30px;" data-autocenter="2" data-scale="0.75" data-scale-left="0.75">
          <svg viewbox="0 0 16000 16000" style="position:absolute;top:0;left:0;width:100%;height:100%;">
            <path class="a" d="M4037.7,8357.3l5891.8,5891.8c100.6,100.6,219.7,150.9,357.3,150.9s256.7-50.3,357.3-150.9 l1318.1-1318.1c100.6-100.6,150.9-219.7,150.9-357.3c0-137.6-50.3-256.7-150.9-357.3L7745.9,8000l4216.4-4216.4 c100.6-100.6,150.9-219.7,150.9-357.3c0-137.6-50.3-256.7-150.9-357.3l-1318.1-1318.1c-100.6-100.6-219.7-150.9-357.3-150.9 s-256.7,50.3-357.3,150.9L4037.7,7642.7c-100.6,100.6-150.9,219.7-150.9,357.3C3886.8,8137.6,3937.1,8256.7,4037.7,8357.3 L4037.7,8357.3z"> </path>
          </svg>
        </div>
        <div data-u="arrowright" class="jssora073" style="width:40px;height:50px;top:0px;right:30px;" data-autocenter="2" data-scale="0.75" data-scale-right="0.75">
          <svg viewbox="0 0 16000 16000" style="position:absolute;top:0;left:0;width:100%;height:100%;">
            <path class="a" d="M11962.3,8357.3l-5891.8,5891.8c-100.6,100.6-219.7,150.9-357.3,150.9s-256.7-50.3-357.3-150.9 L4037.7,12931c-100.6-100.6-150.9-219.7-150.9-357.3c0-137.6,50.3-256.7,150.9-357.3L8254.1,8000L4037.7,3783.6 c-100.6-100.6-150.9-219.7-150.9-357.3c0-137.6,50.3-256.7,150.9-357.3l1318.1-1318.1c100.6-100.6,219.7-150.9,357.3-150.9 s256.7,50.3,357.3,150.9l5891.8,5891.8c100.6,100.6,150.9,219.7,150.9,357.3C12113.2,8137.6,12062.9,8256.7,11962.3,8357.3 L11962.3,8357.3z"> </path>
          </svg>
        </div>
      </div>
      <script type="text/javascript">jssor_1_slider_init();</script> 
      <!-- #endregion Jssor Slider End -->
      
      <p></p>
    </article>
    
    <!-- About -->
    <article id="about">
      <h2 class="major">About</h2>
      <span class="image main"><img src="tattoo-life.jpg" alt="" /></span>
      <p> </p>
    </article>
    
    <!-- Contact -->
    <article id="contact">
      <h2 class="major">Contact</h2>
      <form method="post" action="index.php">
        <div class="fields">
          <div class="field half">
            <label for="name">Name</label>
            <input type="text" name="name" id="name" />
          </div>
          <div class="field half">
            <label for="email">Email</label>
            <input type="text" name="email" id="email" />
          </div>
          <div class="field">
            <label for="message">Message</label>
            <textarea name="message" id="message" rows="4"></textarea>
          </div>
        </div>
        <ul class="actions">
          <li>
            <input type="submit" value="Send Message" class="primary" />
          </li>
          <li>
            <input type="reset" value="Reset" />
          </li>
        </ul>
      </form>
      <ul class="icons">
        <li><a href="https://www.facebook.com/michael.s.maldonado"><i class="fab fa-facebook-f"></i></a></li>
        <li><a href="https://www.instagram.com/michaelm602/"><i class="fab fa-instagram"></i></a></li>
        <li><a href="#"><i class="fab fa-google-plus"></i></a></li>
        <li><a href="#"><i class="fab fa-snapchat"></i></a></li>
      </ul>
    </article>
    
    <!-- Elements --> 
  </div>
  
  <!-- Footer -->
  <footer id="footer">
    <p class="copyright">&copy; The Tattoo Spot</p>
  </footer>
</div>

<!-- BG -->
<div id="bg"></div>

<!-- Scripts --> 
<script src="jquery.min.js"></script> 
<script src="browser.min.js"></script> 
<script src="breakpoints.min.js"></script> 
<script src="util.js"></script> 
<script src="main.js"></script>
</body>
</html>
