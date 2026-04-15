Data from: http://graphdrawing.org/data.html
The data is not tracked on the git since that's just a waste of space, so you need to download the data adn put the
files into the `original` directory.

If you want to ask why there is a docker setup here, you are completely right it shouldn't be here, however, this is
just so the graphviz functionality we want to use is set up properly, since on windows it is just about nearly
impossible to get it run!

Getting the finished data into the `data` directory takes just two steps, we will first start with converting
the `*.graphml` files to json, also giving the nodes actual number ids for easier processing.
To do this run the `rome_graph_conversion.py`, it will scour through the `original` directory and output its contents
to `preprocessed`.

Next, we will add missing fields, in this case the position values like gansner, taken from graphviz's implementation setting all nodes
on the same layer.
Before running this step you might need to install graphviz or simply run the docker compose using `docker compose up`
and then execute the file.
To do this run `python node_order_extraction.py`, because the docker has an image it will directly write the data to the
correct directory `data`.

You could also try to run this on your original system but that might require further debugging of integrating graphviz
into this script.
if you think about doing this on windows, DON'T, just use the container setup and spare yourself the 10 hours.

Having followed these steps your `preprocessed` data should now be in the actual `data` directory and ready for use.