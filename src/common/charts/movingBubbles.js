import * as d3 from "d3";
import { selection } from "d3";
import { caseIds, timeLine, trCode, timeframe, timeStory } from "../data";

const MovingBubbles = function (id) {
  const margin = { top: 0, right: 0, bottom: 0, left: 0 },
    width = 800 - margin.left - margin.right,
    height = 800 - margin.top - margin.bottom,
    chart_radius = 750,
    chart_padding_left = 30,
    node_radius = 3.5,
    padding = 1, // separation between same-color nodes
    cluster_padding = 1.5, // separation between different-color nodes
    cluster_num = Object.keys(trCode).length,
    maxRadius = 12,
    num_nodes = caseIds.length;

  let SPEED_VAL = 300;

  const palette = [
    "#a4b787",
    "#b0cac7", //traveling
    "#f88f01", //sleeping
    "#184d47", //personal care
    "#ffd414", //ed
    "#c70039", //work
    "#81b214", //eat
    "#f05454", //housework
    "#6a492b", //household
    "#007965", //non household
    "#f58634", //shopping
    "#e5707e", //procare
    "#f6c065", //leisure
    "#1a508b", //sport
    "#af0069", //religion
    "#09015f", //volunteering
    "#8f384d", //phonecalls
    "#86aba1", //misc
  ];

  const color = d3.scale
    .threshold()
    .domain(d3.range(cluster_num))
    .range(palette);

  const foci = getFoci();

  let nodes = caseIds.map(function (caseId, i) {
    const obj = timeframe["04:00:00"].filter((a) => a.TUCASEID == caseId)[0];
    if (obj) {
      return {
        id: caseId,
        x: foci[obj ? obj.TRCODE_str : 1].x + Math.random(),
        y: foci[obj ? obj.TRCODE_str : 1].y + Math.random(),
        radius: node_radius,
        choice: obj ? obj.TRCODE_str : 1,
      };
    } else {
      return nodeDefault(caseId);
    }
  });

  const svg = d3
    .select("#".concat(id))
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  //Background
  const layerBg = svg.append("g");
  layerBg
    .append("rect")
    .attr("fill", "white")
    .attr("opacity", 1)
    .attr("x", 0)
    .attr("y", 0)
    .attr("height", height)
    .attr("width", width);

  // INTERFACE

  // CONTROL BUTTON

  d3.selectAll("#speed .button").on("click", function () {
    SPEED_VAL = d3.select(this).attr("data-val");
    d3.select("#speed .current").classed("current", false);
    d3.select(this).classed("current", true);
  });

  // NARRATIVE

  d3.select("#narrative")
    .append("p")
    .attr("class", "text-narrative")
    .html(timeStory["04:00:00"].text);

  // MOVING BUBBLES CHART
  const layerChart = svg
    .append("g")
    .attr("transform", "translate(" + chart_padding_left + "," + 0 + ")");

  const layerBubbles = layerChart.append("g");
  const layerField = layerChart.append("g");
  const layerPercentage = layerChart.append("g").attr("class", "percentage");

  layerField
    .selectAll("text")
    .data(Object.keys(foci))
    .enter()
    .append("text")
    .attr("class", "text")
    .text(function (d) {
      return foci[d].name;
    })
    .attr("transform", function (d) {
      const textWidth = this.getComputedTextLength();
      return `translate(${
        foci[d].xField - textWidth / 2
      }, ${foci[d].yField + 5})`;
    });

  d3.select(".percentage").call(textPercentage);

  let force = d3.layout
    .force()
    .nodes(nodes)
    .size([width, height])
    .gravity(0)
    .charge(0)
    .friction(0.9)
    .on("tick", tick)
    .start();

  let circle = layerBubbles
    .selectAll("circle")
    .data(nodes)
    .enter()
    .append("circle")
    .style("fill", function (d) {
      return foci[d.choice].color;
    });

  circle
    .transition()
    .duration(900)
    .delay(function (d, i) {
      return i * 5;
    })
    .attrTween("r", function (d) {
      let i = d3.interpolate(0, d.radius);
      return function (t) {
        return (d.radius = i(t));
      };
    });

  // Re-Run simulation

  let timeout;
  let i = 1;

  function timer() {
    if (timeframe[timeLine[i]]) {
      for (let obj of timeframe[timeLine[i]]) {
        nodes[obj.case_index].cx = foci[obj.TRCODE_str].x;
        nodes[obj.case_index].cy = foci[obj.TRCODE_str].y;
        nodes[obj.case_index].choice = obj.TRCODE_str;
      }
    }

    layerPercentage.selectAll(".text-percentage").remove();
    d3.select(".percentage").call(textPercentage);

    // layerClock.select(".text-clock").remove();

    d3.selectAll(".text-clock").remove();
    d3.select("#timecnt")
      .append("h2")
      .attr("class", "text-clock")
      .html(timeLine[i].slice(0, 5));

    if (timeStory[timeLine[i]]) {
      if (timeStory[timeLine[i]].status === "out") {
        d3.select(".text-narrative").classed("remove-narrative", true);
      } else if (timeStory[timeLine[i]].status === "in") {
        d3.select(".text-narrative").remove();
        d3.select("#narrative")
          .append("p")
          .attr("class", "text-narrative")
          .html(timeStory[timeLine[i]].text);
      }
    }

    force.resume();
    if (i < 1439) {
      i++;
    } else {
      i = 0;
    }

    setTimeout(timer, SPEED_VAL);
  }

  timeout = setTimeout(timer, SPEED_VAL);

  //

  function tick(e) {
    circle
      .each(gravity(0.051 * e.alpha))
      .each(collide(0.2))
      .style("fill", function (d) {
        return foci[d.choice].color;
      })
      .attr("cx", function (d) {
        return d.x;
      })
      .attr("cy", function (d) {
        return d.y;
      });
  }

  // Move nodes toward cluster focus.
  function gravity(alpha) {
    return function (d) {
      d.y += (foci[d.choice].y - d.y) * alpha;
      d.x += (foci[d.choice].x - d.x) * alpha;
    };
  }

  // Move d to be adjacent to the cluster node.
  function cluster(alpha) {
    return function (d) {
      let cluster = clusters[d.cluster];
      if (cluster === d) return;
      let x = d.x - cluster.x,
        y = d.y - cluster.y,
        l = Math.sqrt(x * x + y * y),
        r = d.radius + cluster.radius;
      if (l != r) {
        l = ((l - r) / l) * alpha;
        d.x -= x *= l;
        d.y -= y *= l;
        cluster.x += x;
        cluster.y += y;
      }
    };
  }

  // Resolve collisions between nodes.
  function collide(alpha) {
    let quadtree = d3.geom.quadtree(nodes);
    return function (d) {
      let r = d.radius + node_radius + Math.max(padding, cluster_padding),
        nx1 = d.x - r,
        nx2 = d.x + r,
        ny1 = d.y - r,
        ny2 = d.y + r;
      quadtree.visit(function (quad, x1, y1, x2, y2) {
        if (quad.point && quad.point !== d) {
          let x = d.x - quad.point.x,
            y = d.y - quad.point.y,
            l = Math.sqrt(x * x + y * y),
            r =
              d.radius +
              quad.point.radius +
              (d.choice === quad.point.choice ? padding : cluster_padding);
          if (l < r) {
            l = ((l - r) / l) * alpha;
            d.x -= x *= l;
            d.y -= y *= l;
            quad.point.x += x;
            quad.point.y += y;
          }
        }
        return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
      });
    };
  }

  function getFoci() {
    const foci = {};
    Object.keys(trCode).map(function (key, i) {
      const x =
        Math.sin(((i + 1) / (cluster_num - 1)) * 2 * Math.PI) *
          (chart_radius / 2 - 100) +
        chart_radius / 2;
      const y =
        Math.cos(((i + 1) / (cluster_num - 1)) * 2 * Math.PI) *
          (chart_radius / 2 - 100) +
        chart_radius / 2;
      const xField =
        Math.sin(((i + 1) / (cluster_num - 1)) * 2 * Math.PI) *
          (chart_radius / 2 - 20) +
        chart_radius / 2;
      const yField =
        Math.cos(((i + 1) / (cluster_num - 1)) * 2 * Math.PI) *
          (chart_radius / 2 - 20) +
        chart_radius / 2;
      foci[key] = {
        name: trCode[key],
        x: i == 0 ? chart_radius / 2 : x,
        y: i == 0 ? chart_radius / 2 : y,
        xField: i == 0 ? chart_radius / 2 - 40 : xField,
        yField: i == 0 ? chart_radius / 2 - 20 : yField,
        color: color(i),
      };
    });
    return foci;
  }
  function textPercentage(selection) {
    selection
      .selectAll("text")
      .data(Object.keys(foci))
      .enter()
      .append("text")
      .attr("class", "text text-percentage")
      .text(function (d) {
        const percentage = nodes.filter((node) => node.choice == d).length;
        const text = `${((percentage / num_nodes) * 100).toFixed(1)} %`;
        return text;
      })
      .attr("transform", function (d) {
        const textWidth = this.getComputedTextLength();
        return `translate(${
          foci[d].xField - textWidth / 2
        }, ${foci[d].yField + 20})`;
      });
  }

  function nodeDefault(caseId) {
    return {
      id: caseId,
      x: foci[1].x + Math.random(),
      y: foci[1].y + Math.random(),
      radius: node_radius,
      choice: 1,
    };
  }


};

export default MovingBubbles;
